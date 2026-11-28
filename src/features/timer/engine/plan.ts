/**
 * Pure helpers that build and finalize session plans. No clocks, no I/O:
 * callers pass the current time and an id generator.
 */
import { SessionType, type SessionPlan, type SessionPlanSegment } from '../types';

export type NewId = () => string;

export interface PlanSettings {
  focusDuration: number; // minutes
  shortBreakDuration: number; // minutes
}

interface SegmentSpec {
  type: SessionType;
  duration: number; // seconds
}

/** Splits a total duration into alternating focus and break segments. */
export function splitIntoSegments(totalMinutes: number, settings: PlanSettings): SegmentSpec[] {
  const focus = Math.max(1, Math.round(settings.focusDuration * 60));
  const rest = Math.max(1, Math.round(settings.shortBreakDuration * 60));
  const specs: SegmentSpec[] = [];
  let remaining = Math.max(0, Math.round(totalMinutes * 60));
  while (remaining > 0) {
    const isFocus = specs.length % 2 === 0;
    const duration = Math.min(isFocus ? focus : rest, remaining);
    specs.push({ type: isFocus ? SessionType.FOCUS : SessionType.SHORT_BREAK, duration });
    remaining -= duration;
  }
  return specs;
}

/** A new active plan whose first segment starts running at `now`. */
export function createPlan(
  specs: SegmentSpec[],
  settings: PlanSettings,
  now: number,
  newId: NewId,
): SessionPlan {
  let cursor = now;
  const segments: SessionPlanSegment[] = specs.map((spec, index) => {
    const segment: SessionPlanSegment = {
      id: newId(),
      index,
      type: spec.type,
      plannedDuration: spec.duration,
      actualDuration: null,
      expectedStartTime: cursor,
      expectedEndTime: cursor + spec.duration * 1000,
      actualStartTime: index === 0 ? now : null,
      actualEndTime: null,
      status: index === 0 ? 'in_progress' : 'pending',
      pausedTime: 0,
      elapsedAtLastUpdate: 0,
    };
    cursor = segment.expectedEndTime;
    return segment;
  });

  return {
    id: newId(),
    createdAt: now,
    status: 'active',
    segments,
    currentSegmentIndex: 0,
    settings: {
      focusDuration: settings.focusDuration,
      shortBreakDuration: settings.shortBreakDuration,
    },
    expectedEndTime: cursor,
    actualEndTime: null,
    interruptedAt: null,
    totalPlannedDuration: specs.reduce((sum, s) => sum + s.duration, 0),
    totalElapsed: 0,
    lastUpdated: now,
  };
}

/** Seconds of completed work recorded on a plan's segments. */
export function totalElapsed(segments: SessionPlanSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.actualDuration ?? 0), 0);
}

const isUnfinished = (s: SessionPlanSegment) =>
  s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted';

const elapsedSoFar = (s: SessionPlanSegment) =>
  Math.max(s.elapsedAtLastUpdate || 0, s.actualDuration || 0);

/**
 * Carries the unfinished work of an interrupted plan into a new plan starting
 * at `now`. A partially-run first segment continues with the time it had left.
 * The old plan is finalized (its unfinished segments marked `skipped`, keeping
 * their elapsed time) so it is no longer offered for resuming.
 * Returns null when nothing is left to resume.
 */
export function resumePlan(
  oldPlan: SessionPlan,
  now: number,
  newId: NewId,
): { plan: SessionPlan; finalizedOld: SessionPlan } | null {
  const remaining = oldPlan.segments.filter(isUnfinished);
  if (remaining.length === 0) return null;

  const specs: SegmentSpec[] = remaining.map((seg, i) => {
    const isPartial = i === 0 && (seg.status === 'in_progress' || seg.status === 'interrupted');
    return {
      type: seg.type,
      duration: isPartial
        ? Math.max(1, seg.plannedDuration - elapsedSoFar(seg))
        : seg.plannedDuration,
    };
  });
  const plan = createPlan(specs, oldPlan.settings, now, newId);

  const finalizedSegments = oldPlan.segments.map((s) =>
    isUnfinished(s)
      ? {
          ...s,
          status: 'skipped' as const,
          actualEndTime: s.actualEndTime ?? now,
          actualDuration: elapsedSoFar(s),
        }
      : s,
  );
  const finalizedOld: SessionPlan = {
    ...oldPlan,
    segments: finalizedSegments,
    status: 'interrupted',
    interruptedAt: now,
    actualEndTime: now,
    totalElapsed: totalElapsed(finalizedSegments),
    lastUpdated: now,
  };

  return { plan, finalizedOld };
}
