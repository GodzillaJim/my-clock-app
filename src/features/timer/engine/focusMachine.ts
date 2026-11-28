/**
 * The focus timer as a pure state machine.
 *
 *   idle ──START / RESUME_PLAN──▶ running ⇄ paused
 *                                   │  TICK (segment ends) / SKIP → next segment
 *                                   ├─ last segment ends ──▶ complete ──RESET──▶ idle
 *                                   └─ STOP ──▶ idle (plan abandoned)
 *
 * Sleep and clock changes (see SUSPEND_GAP_MS):
 * - The computer sleeping pauses the session at the moment it went to sleep,
 *   from either the system's suspend notice (SUSPEND) or, failing that, a gap
 *   between ticks longer than SUSPEND_GAP_MS. Time asleep never counts as
 *   focus, and the user resumes when they are back.
 * - The wall clock jumping backwards (a manual change, a time sync) shifts the
 *   running span by the same amount, so the countdown neither stalls nor
 *   repeats. A small forward jump counts as elapsed time; a large one looks
 *   like sleep and pauses.
 *
 * `transition` never reads the clock or touches storage: every event carries
 * `now`, and side effects (persistence, notifications) are returned as data
 * for the caller to run. Time is tracked as active milliseconds, so pauses
 * never count as focus time.
 */
import {
  CompletionStatus,
  SessionType,
  type SessionNotification,
  type SessionPlan,
  type SessionPlanSegment,
  type SessionRecord,
} from '../types';
import {
  createPlan,
  resumePlan,
  splitIntoSegments,
  totalElapsed,
  type NewId,
  type PlanSettings,
} from './plan';

export type FocusPhase = 'idle' | 'running' | 'paused' | 'complete';

export interface FocusState {
  phase: FocusPhase;
  /** The plan being run; in `complete`, the finished plan. */
  plan: SessionPlan | null;
  /** Index of the current segment in `plan.segments`. */
  index: number;
  /** Active milliseconds of the current segment before `runningSince`. */
  elapsedMs: number;
  /** Start of the current running span; null while paused or idle. */
  runningSince: number | null;
  /** When the current pause began. */
  pausedAt: number | null;
  /** Milliseconds the current segment has spent paused. */
  pausedMs: number;
  /** When the crash-recovery snapshot was last written. */
  lastSnapshotAt: number;
  /** Clock reading of the previous TICK (or start/resume), to notice sleep and clock jumps. */
  lastTickAt: number;
}

export type FocusEvent =
  | { type: 'START'; now: number; totalMinutes: number; settings: PlanSettings }
  | { type: 'RESUME_PLAN'; now: number; plan: SessionPlan }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'TICK'; now: number }
  /** The system is going to sleep; `at` is when (it may arrive after waking). */
  | { type: 'SUSPEND'; at: number }
  | { type: 'SKIP'; now: number }
  | { type: 'STOP'; now: number }
  | { type: 'RESET' }
  /** Write the crash-recovery snapshot now (before unload, after an error). */
  | { type: 'SNAPSHOT'; now: number }
  /** Development aid: jump `seconds` ahead in the current segment. */
  | { type: 'FAST_FORWARD'; now: number; seconds: number };

export type FocusNotification = Pick<SessionNotification, 'type' | 'title' | 'body'>;

export type FocusEffect =
  | { type: 'savePlan'; plan: SessionPlan }
  | { type: 'savePlanSnapshot'; plan: SessionPlan }
  | { type: 'clearPlanSnapshot' }
  | { type: 'recordSession'; record: SessionRecord }
  | { type: 'notify'; notification: FocusNotification }
  | { type: 'recalculateStats' };

export interface Transition {
  state: FocusState;
  effects: FocusEffect[];
}

export interface FocusDeps {
  newId: NewId;
}

/** How often the running plan is snapshotted for crash recovery. */
export const SNAPSHOT_INTERVAL_MS = 5000;

/**
 * Ticks arrive every 250 ms (the window is never throttled). A gap longer than
 * this means the app was frozen (sleep, hibernate, a suspended VM) and is
 * treated as a pause starting at the last tick.
 */
export const SUSPEND_GAP_MS = 30_000;

/** A backwards clock jump larger than this is corrected for. */
export const CLOCK_JUMP_TOLERANCE_MS = 2_000;

export const initialFocusState: FocusState = {
  phase: 'idle',
  plan: null,
  index: 0,
  elapsedMs: 0,
  runningSince: null,
  pausedAt: null,
  pausedMs: 0,
  lastSnapshotAt: 0,
  lastTickAt: 0,
};

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function currentSegment(state: FocusState): SessionPlanSegment | null {
  return state.plan?.segments[state.index] ?? null;
}

/** Active (unpaused) milliseconds spent in the current segment. */
export function activeMs(state: FocusState, now: number): number {
  return (
    state.elapsedMs + (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince))
  );
}

export function remainingMs(state: FocusState, now: number): number {
  const segment = currentSegment(state);
  if (!segment || state.phase === 'idle' || state.phase === 'complete') return 0;
  return Math.max(0, segment.plannedDuration * 1000 - activeMs(state, now));
}

/** Whole seconds left in the current segment, rounded up (25:00 at the start). */
export function remainingSeconds(state: FocusState, now: number): number {
  return Math.ceil(remainingMs(state, now) / 1000);
}

/** Share of the current segment already done, 0–100. */
export function progressPercent(state: FocusState, now: number): number {
  const segment = currentSegment(state);
  if (!segment || segment.plannedDuration <= 0) return 0;
  const done = activeMs(state, now) / (segment.plannedDuration * 1000);
  return Math.max(0, Math.min(100, done * 100));
}

/** When the whole plan ends if it keeps running from `now`. */
export function planEndsAt(state: FocusState, now: number): number {
  const segments = state.plan?.segments ?? [];
  const later = segments.slice(state.index + 1).reduce((sum, s) => sum + s.plannedDuration, 0);
  return now + remainingMs(state, now) + later * 1000;
}

export function isBreakSegment(segment: SessionPlanSegment | null): boolean {
  return !!segment && segment.type !== SessionType.FOCUS;
}

/** Seconds of focus recorded on the plan's finished focus segments (breaks excluded). */
export function focusSecondsDone(state: FocusState): number {
  return (state.plan?.segments ?? [])
    .filter((s) => s.type === SessionType.FOCUS)
    .reduce((sum, s) => sum + (s.actualDuration ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

const unchanged = (state: FocusState): Transition => ({ state, effects: [] });

function freshSegmentState(plan: SessionPlan, index: number, now: number): FocusState {
  return {
    phase: 'running',
    plan,
    index,
    elapsedMs: 0,
    runningSince: now,
    pausedAt: null,
    pausedMs: 0,
    lastSnapshotAt: now,
    lastTickAt: now,
  };
}

/** Pauses a running segment as of `at` and snapshots it. */
function pauseAt(state: FocusState, at: number, effects: FocusEffect[] = []): Transition {
  const paused: FocusState = {
    ...state,
    phase: 'paused',
    elapsedMs: activeMs(state, at),
    runningSince: null,
    pausedAt: at,
  };
  const plan = withProgress(paused, at);
  return {
    state: { ...paused, plan, lastSnapshotAt: at },
    effects: [{ type: 'savePlanSnapshot', plan }, ...effects],
  };
}

const sleptNotice: FocusEffect = {
  type: 'notify',
  notification: {
    type: 'break_reminder',
    title: 'Session paused',
    body: 'Your computer went to sleep, so the session was paused. Resume when you are back.',
  },
};

/** Paused time of the current segment, including an ongoing pause. */
function pausedMsAt(state: FocusState, now: number): number {
  return state.pausedMs + (state.pausedAt === null ? 0 : Math.max(0, now - state.pausedAt));
}

function sessionRecord(
  state: FocusState,
  segment: SessionPlanSegment,
  now: number,
  status: CompletionStatus,
  actualSeconds: number,
): SessionRecord {
  // Set by createPlan / finishSegment whenever a segment becomes current
  const startedAt = segment.actualStartTime!;
  return {
    id: `${startedAt}-${state.index}`,
    type: segment.type,
    sessionNumber: state.index + 1,
    plannedDuration: segment.plannedDuration,
    actualDuration: actualSeconds,
    startTime: new Date(startedAt),
    endTime: new Date(now),
    pausedTime: pausedMsAt(state, now),
    completionStatus: status,
    remainingTime: Math.max(0, segment.plannedDuration - actualSeconds),
  };
}

function withSegments(
  plan: SessionPlan,
  segments: SessionPlanSegment[],
  now: number,
  extra: Partial<SessionPlan> = {},
): SessionPlan {
  return { ...plan, segments, totalElapsed: totalElapsed(segments), lastUpdated: now, ...extra };
}

const segmentNotification = (segment: SessionPlanSegment): FocusNotification =>
  segment.type === SessionType.FOCUS
    ? { type: 'session_start', title: 'Focus Time!', body: 'Time to focus.' }
    : { type: 'break_complete', title: 'Break Time!', body: 'Take a short break.' };

/**
 * Ends the current segment with `status` and moves on: to the next segment
 * when there is one, otherwise to `complete`.
 */
function finishSegment(
  state: FocusState,
  now: number,
  status: 'completed' | 'skipped',
): Transition {
  const plan = state.plan!;
  const segment = plan.segments[state.index];
  const actualSeconds = Math.min(segment.plannedDuration, Math.round(activeMs(state, now) / 1000));
  const record = sessionRecord(
    state,
    segment,
    now,
    status === 'completed' ? CompletionStatus.COMPLETED : CompletionStatus.SKIPPED,
    actualSeconds,
  );

  const segments = [...plan.segments];
  segments[state.index] = {
    ...segment,
    status,
    actualEndTime: now,
    actualDuration: actualSeconds,
    elapsedAtLastUpdate: actualSeconds,
    pausedTime: pausedMsAt(state, now),
  };

  const nextIndex = state.index + 1;
  if (nextIndex < segments.length) {
    segments[nextIndex] = { ...segments[nextIndex], status: 'in_progress', actualStartTime: now };
    const next = withSegments(plan, segments, now, { currentSegmentIndex: nextIndex });
    return {
      state: freshSegmentState(next, nextIndex, now),
      effects: [
        { type: 'recordSession', record },
        { type: 'savePlan', plan: next },
        { type: 'savePlanSnapshot', plan: next },
        { type: 'notify', notification: segmentNotification(segments[nextIndex]) },
      ],
    };
  }

  const finished = withSegments(plan, segments, now, { status: 'completed', actualEndTime: now });
  return {
    state: { ...initialFocusState, phase: 'complete', plan: finished, index: state.index },
    effects: [
      { type: 'recordSession', record },
      { type: 'savePlan', plan: finished },
      { type: 'clearPlanSnapshot' },
      { type: 'recalculateStats' },
      {
        type: 'notify',
        notification: {
          type: 'session_complete',
          title: 'Session Complete!',
          body: "Great work! You've completed your focus session.",
        },
      },
    ],
  };
}

/** The running plan with the current segment's progress recorded, for snapshots. */
function withProgress(state: FocusState, now: number): SessionPlan {
  const plan = state.plan!;
  const segments = [...plan.segments];
  const elapsed = Math.floor(activeMs(state, now) / 1000);
  segments[state.index] = {
    ...segments[state.index],
    elapsedAtLastUpdate: elapsed,
    pausedTime: pausedMsAt(state, now),
  };
  const done = segments.reduce(
    (sum, s, i) => sum + (i === state.index ? elapsed : (s.actualDuration ?? 0)),
    0,
  );
  return { ...plan, segments, totalElapsed: done, lastUpdated: now };
}

export function transition(state: FocusState, event: FocusEvent, deps: FocusDeps): Transition {
  switch (event.type) {
    case 'START': {
      if (state.phase !== 'idle') return unchanged(state);
      const specs = splitIntoSegments(event.totalMinutes, event.settings);
      if (specs.length === 0) return unchanged(state);
      const plan = createPlan(specs, event.settings, event.now, deps.newId);
      return {
        state: freshSegmentState(plan, 0, event.now),
        effects: [
          { type: 'savePlan', plan },
          { type: 'savePlanSnapshot', plan },
          {
            type: 'notify',
            notification: {
              type: 'session_start',
              title: 'Focus Started',
              body: `${event.totalMinutes} minute focus session begun.`,
            },
          },
        ],
      };
    }

    case 'RESUME_PLAN': {
      if (state.phase !== 'idle') return unchanged(state);
      const resumed = resumePlan(event.plan, event.now, deps.newId);
      if (!resumed) return unchanged(state);
      const { plan, finalizedOld } = resumed;
      return {
        state: freshSegmentState(plan, 0, event.now),
        effects: [
          { type: 'savePlan', plan },
          { type: 'savePlanSnapshot', plan },
          { type: 'savePlan', plan: finalizedOld },
          {
            type: 'notify',
            notification: {
              type: 'session_start',
              title: 'Session Resumed',
              body: `Resuming with ${plan.segments.length} segments (${Math.round(plan.totalPlannedDuration / 60)}m remaining).`,
            },
          },
        ],
      };
    }

    case 'PAUSE':
      return state.phase === 'running' ? pauseAt(state, event.now) : unchanged(state);

    case 'SUSPEND':
      // Already paused (by the user, or by the tick-gap check after waking): nothing to do
      if (state.phase !== 'running') return unchanged(state);
      return pauseAt(state, Math.max(event.at, state.runningSince!), [sleptNotice]);

    case 'RESUME': {
      if (state.phase !== 'paused') return unchanged(state);
      return {
        state: {
          ...state,
          phase: 'running',
          runningSince: event.now,
          pausedMs: pausedMsAt(state, event.now),
          pausedAt: null,
          lastTickAt: event.now,
        },
        effects: [],
      };
    }

    case 'TICK': {
      if (state.phase !== 'running') return unchanged(state);
      const gap = event.now - state.lastTickAt;
      // Frozen for a long time (sleep, hibernate): pause as of the last tick
      if (gap > SUSPEND_GAP_MS) return pauseAt(state, state.lastTickAt, [sleptNotice]);

      let ticked: FocusState = { ...state, lastTickAt: event.now };
      if (gap < -CLOCK_JUMP_TOLERANCE_MS) {
        // The clock went back: move the running span with it so no time is lost or repeated
        ticked = {
          ...ticked,
          runningSince: state.runningSince! + gap,
          lastSnapshotAt: Math.min(state.lastSnapshotAt, event.now),
        };
      }
      if (remainingMs(ticked, event.now) <= 0) {
        return finishSegment(ticked, event.now, 'completed');
      }
      if (event.now - ticked.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) {
        return { state: ticked, effects: [] };
      }
      const plan = withProgress(ticked, event.now);
      return {
        state: { ...ticked, plan, lastSnapshotAt: event.now },
        effects: [{ type: 'savePlanSnapshot', plan }],
      };
    }

    case 'SKIP': {
      if (state.phase !== 'running' && state.phase !== 'paused') return unchanged(state);
      // The last segment can only be finished or stopped, not skipped
      if (state.index >= state.plan!.segments.length - 1) return unchanged(state);
      return finishSegment(state, event.now, 'skipped');
    }

    case 'STOP': {
      if (state.phase !== 'running' && state.phase !== 'paused') return unchanged(state);
      const plan = state.plan!;
      const segment = plan.segments[state.index];
      const actualSeconds = Math.round(activeMs(state, event.now) / 1000);
      const segments = [...plan.segments];
      segments[state.index] = {
        ...segment,
        status: 'interrupted',
        actualEndTime: event.now,
        actualDuration: actualSeconds,
        elapsedAtLastUpdate: actualSeconds,
        pausedTime: pausedMsAt(state, event.now),
      };
      const abandoned = withSegments(plan, segments, event.now, {
        status: 'abandoned',
        actualEndTime: event.now,
      });
      return {
        state: initialFocusState,
        effects: [
          {
            type: 'recordSession',
            record: sessionRecord(
              state,
              segment,
              event.now,
              CompletionStatus.INTERRUPTED,
              actualSeconds,
            ),
          },
          { type: 'savePlan', plan: abandoned },
          { type: 'clearPlanSnapshot' },
          { type: 'recalculateStats' },
        ],
      };
    }

    case 'SNAPSHOT': {
      if (state.phase !== 'running' && state.phase !== 'paused') return unchanged(state);
      const plan = withProgress(state, event.now);
      return {
        state: { ...state, plan, lastSnapshotAt: event.now },
        effects: [{ type: 'savePlanSnapshot', plan }],
      };
    }

    case 'RESET':
      return state.phase === 'complete'
        ? { state: initialFocusState, effects: [] }
        : unchanged(state);

    case 'FAST_FORWARD': {
      if (state.phase !== 'running') return unchanged(state);
      const segment = currentSegment(state)!;
      // Leave at least a second so the jump never skips the segment's end handling
      const target = Math.min(
        segment.plannedDuration * 1000 - 1000,
        activeMs(state, event.now) + event.seconds * 1000,
      );
      return {
        state: {
          ...state,
          elapsedMs: Math.max(0, target),
          runningSince: event.now,
          lastTickAt: event.now,
        },
        effects: [],
      };
    }
  }
}
