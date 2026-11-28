import { describe, expect, it } from 'vitest';
import {
  activeMs,
  currentSegment,
  initialFocusState,
  isBreakSegment,
  planEndsAt,
  progressPercent,
  remainingMs,
  remainingSeconds,
  SNAPSHOT_INTERVAL_MS,
  transition,
  type FocusEffect,
  type FocusEvent,
  type FocusState,
} from '../focusMachine';
import { CompletionStatus, SessionType, type SessionPlan } from '../../types';

const T0 = Date.UTC(2026, 0, 1, 9, 0, 0);
const MIN = 60_000;
const settings = { focusDuration: 1, shortBreakDuration: 2 }; // 1m focus, 2m break

const deps = () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
};

/** Runs events in order, collecting every effect. */
function run(events: FocusEvent[], from: FocusState = initialFocusState) {
  const d = deps();
  let state = from;
  const effects: FocusEffect[] = [];
  for (const event of events) {
    const result = transition(state, event, d);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const start = (totalMinutes = 4, now = T0): FocusEvent => ({
  type: 'START',
  now,
  totalMinutes,
  settings,
});

const of = <T extends FocusEffect['type']>(effects: FocusEffect[], type: T) =>
  effects.filter((e): e is Extract<FocusEffect, { type: T }> => e.type === type);

describe('START', () => {
  it('builds alternating segments and starts the first one', () => {
    const { state, effects } = run([start(4)]); // F1 B2 F1
    expect(state.phase).toBe('running');
    expect(state.plan!.segments.map((s) => [s.type, s.plannedDuration, s.status])).toEqual([
      [SessionType.FOCUS, 60, 'in_progress'],
      [SessionType.SHORT_BREAK, 120, 'pending'],
      [SessionType.FOCUS, 60, 'pending'],
    ]);
    expect(state.plan!.segments[0].actualStartTime).toBe(T0);
    expect(state.plan!.expectedEndTime).toBe(T0 + 4 * MIN);
    expect(effects.map((e) => e.type)).toEqual(['savePlan', 'savePlanSnapshot', 'notify']);
    expect(of(effects, 'notify')[0].notification.title).toBe('Focus Started');
  });

  it('truncates the last segment to the time that is left', () => {
    const { state } = run([start(2.5)]); // F1 B1.5
    expect(state.plan!.segments.map((s) => s.plannedDuration)).toEqual([60, 90]);
  });

  it('is ignored unless idle, and for an empty duration', () => {
    const running = run([start()]).state;
    expect(transition(running, start(), deps()).state).toBe(running);
    expect(run([start(0)]).state).toBe(initialFocusState);
  });
});

describe('time keeping', () => {
  it('counts down only while running', () => {
    const { state } = run([start(), { type: 'PAUSE', now: T0 + 10_000 }]);
    expect(remainingSeconds(state, T0 + 10_000)).toBe(50);
    // Time passes while paused: nothing changes
    expect(remainingSeconds(state, T0 + 40_000)).toBe(50);

    const resumed = run([{ type: 'RESUME', now: T0 + 40_000 }], state).state;
    expect(remainingSeconds(resumed, T0 + 45_000)).toBe(45);
    expect(activeMs(resumed, T0 + 45_000)).toBe(15_000);
    expect(progressPercent(resumed, T0 + 45_000)).toBe(25);
  });

  it('rounds the remaining time up so a fresh segment shows its full length', () => {
    const { state } = run([start()]);
    expect(remainingSeconds(state, T0)).toBe(60);
    expect(remainingSeconds(state, T0 + 1)).toBe(60);
    expect(remainingSeconds(state, T0 + 1000)).toBe(59);
  });

  it('reports when the segment and the whole plan end', () => {
    const { state } = run([start(4)]);
    expect(planEndsAt(state, T0)).toBe(T0 + 4 * MIN);
    // Paused 30s: everything shifts by 30s
    const paused = run([{ type: 'PAUSE', now: T0 + 10_000 }], state).state;
    expect(planEndsAt(paused, T0 + 40_000)).toBe(T0 + 40_000 + 50_000 + 3 * MIN);
  });

  it('has no time left when idle or complete', () => {
    expect(remainingMs(initialFocusState, T0)).toBe(0);
    expect(progressPercent(initialFocusState, T0)).toBe(0);
    expect(currentSegment(initialFocusState)).toBeNull();
  });
});

describe('TICK', () => {
  it('moves on to the next segment when the current one ends', () => {
    const { state, effects } = run([start(4), { type: 'TICK', now: T0 + MIN }]);
    expect(state.phase).toBe('running');
    expect(state.index).toBe(1);
    expect(isBreakSegment(currentSegment(state))).toBe(true);
    expect(remainingSeconds(state, T0 + MIN)).toBe(120);

    const plan = state.plan!;
    expect(plan.currentSegmentIndex).toBe(1);
    expect(plan.segments[0]).toMatchObject({ status: 'completed', actualDuration: 60 });
    expect(plan.segments[1]).toMatchObject({ status: 'in_progress', actualStartTime: T0 + MIN });
    expect(plan.totalElapsed).toBe(60);

    const [record] = of(effects, 'recordSession');
    expect(record.record).toMatchObject({
      type: SessionType.FOCUS,
      sessionNumber: 1,
      actualDuration: 60,
      completionStatus: CompletionStatus.COMPLETED,
      pausedTime: 0,
    });
    expect(of(effects, 'notify').at(-1)!.notification.title).toBe('Break Time!');
  });

  it('announces focus again after a break', () => {
    const { effects } = run([
      start(4),
      { type: 'TICK', now: T0 + MIN },
      { type: 'TICK', now: T0 + 3 * MIN },
    ]);
    expect(of(effects, 'notify').at(-1)!.notification.title).toBe('Focus Time!');
  });

  it('completes the plan after the last segment', () => {
    const { state, effects } = run([start(1), { type: 'TICK', now: T0 + MIN }]);
    expect(state.phase).toBe('complete');
    expect(state.plan!.status).toBe('completed');
    expect(state.plan!.actualEndTime).toBe(T0 + MIN);
    expect(effects.map((e) => e.type)).toEqual([
      'savePlan',
      'savePlanSnapshot',
      'notify',
      'recordSession',
      'savePlan',
      'clearPlanSnapshot',
      'clearSessionSnapshot',
      'recalculateStats',
      'notify',
    ]);
  });

  it('records active time, excluding pauses', () => {
    const { effects } = run([
      start(1),
      { type: 'PAUSE', now: T0 + 20_000 },
      { type: 'RESUME', now: T0 + 50_000 },
      { type: 'TICK', now: T0 + 90_000 },
    ]);
    const [record] = of(effects, 'recordSession');
    expect(record.record.actualDuration).toBe(60);
    expect(record.record.pausedTime).toBe(30_000);
    expect(record.record.endTime).toEqual(new Date(T0 + 90_000));
  });

  it('snapshots progress for crash recovery every few seconds', () => {
    const started = run([start()]).state;
    const early = transition(started, { type: 'TICK', now: T0 + 1000 }, deps());
    expect(early.state).toBe(started);
    expect(early.effects).toEqual([]);

    const later = transition(started, { type: 'TICK', now: T0 + SNAPSHOT_INTERVAL_MS }, deps());
    const [snapshot] = of(later.effects, 'savePlanSnapshot');
    expect(snapshot.plan.segments[0].elapsedAtLastUpdate).toBe(5);
    expect(snapshot.plan.totalElapsed).toBe(5);
    expect(later.state.lastSnapshotAt).toBe(T0 + SNAPSHOT_INTERVAL_MS);
  });

  it('does nothing unless running', () => {
    expect(transition(initialFocusState, { type: 'TICK', now: T0 }, deps()).state).toBe(
      initialFocusState,
    );
    const paused = run([start(1), { type: 'PAUSE', now: T0 }]).state;
    expect(transition(paused, { type: 'TICK', now: T0 + 10 * MIN }, deps()).state).toBe(paused);
  });
});

describe('PAUSE / RESUME', () => {
  it('pauses a running segment and snapshots it', () => {
    const { state, effects } = run([start(), { type: 'PAUSE', now: T0 + 7000 }]);
    expect(state.phase).toBe('paused');
    expect(of(effects, 'savePlanSnapshot').at(-1)!.plan.segments[0]).toMatchObject({
      elapsedAtLastUpdate: 7,
    });
  });

  it('accumulates paused time across several pauses', () => {
    const { state, effects } = run([
      start(1),
      { type: 'PAUSE', now: T0 + 10_000 },
      { type: 'RESUME', now: T0 + 15_000 },
      { type: 'PAUSE', now: T0 + 20_000 },
      { type: 'RESUME', now: T0 + 30_000 },
    ]);
    expect(state.pausedMs).toBe(15_000);
    expect(remainingSeconds(state, T0 + 30_000)).toBe(45);
    expect(effects.length).toBeGreaterThan(0);
  });

  it('ignores PAUSE unless running and RESUME unless paused', () => {
    const running = run([start()]).state;
    expect(transition(running, { type: 'RESUME', now: T0 }, deps()).state).toBe(running);
    expect(transition(initialFocusState, { type: 'PAUSE', now: T0 }, deps()).state).toBe(
      initialFocusState,
    );
  });
});

describe('SKIP', () => {
  it('skips the current segment, keeping the time spent on it', () => {
    const { state, effects } = run([start(4), { type: 'SKIP', now: T0 + 20_000 }]);
    expect(state.index).toBe(1);
    expect(state.plan!.segments[0]).toMatchObject({ status: 'skipped', actualDuration: 20 });
    expect(of(effects, 'recordSession')[0].record).toMatchObject({
      completionStatus: CompletionStatus.SKIPPED,
      actualDuration: 20,
      remainingTime: 40,
    });
  });

  it('works while paused', () => {
    const { state } = run([
      start(4),
      { type: 'PAUSE', now: T0 + 5000 },
      { type: 'SKIP', now: T0 + 9000 },
    ]);
    expect(state.phase).toBe('running');
    expect(state.index).toBe(1);
  });

  it('cannot skip the last segment or when idle', () => {
    const last = run([start(1)]).state;
    expect(transition(last, { type: 'SKIP', now: T0 }, deps()).state).toBe(last);
    expect(transition(initialFocusState, { type: 'SKIP', now: T0 }, deps()).state).toBe(
      initialFocusState,
    );
  });
});

describe('STOP', () => {
  it('abandons the plan, records an interruption and returns to idle', () => {
    const { state, effects } = run([
      start(4),
      { type: 'PAUSE', now: T0 + 30_000 },
      { type: 'STOP', now: T0 + 50_000 },
    ]);
    expect(state).toBe(initialFocusState);

    const saved = of(effects, 'savePlan').at(-1)!.plan;
    expect(saved.status).toBe('abandoned');
    expect(saved.actualEndTime).toBe(T0 + 50_000);
    expect(saved.segments[0]).toMatchObject({
      status: 'interrupted',
      actualDuration: 30,
      pausedTime: 20_000,
    });
    expect(saved.segments[1].status).toBe('pending');
    expect(of(effects, 'recordSession')[0].record.completionStatus).toBe(
      CompletionStatus.INTERRUPTED,
    );
    expect(effects.map((e) => e.type)).toEqual(
      expect.arrayContaining(['clearPlanSnapshot', 'clearSessionSnapshot', 'recalculateStats']),
    );
  });

  it('is ignored when nothing is running', () => {
    expect(transition(initialFocusState, { type: 'STOP', now: T0 }, deps())).toEqual({
      state: initialFocusState,
      effects: [],
    });
  });
});

describe('RESET', () => {
  it('returns from complete to idle, and only from complete', () => {
    const complete = run([start(1), { type: 'TICK', now: T0 + MIN }]).state;
    expect(transition(complete, { type: 'RESET' }, deps()).state).toBe(initialFocusState);
    const running = run([start()]).state;
    expect(transition(running, { type: 'RESET' }, deps()).state).toBe(running);
  });
});

describe('SNAPSHOT', () => {
  it('writes the current progress immediately, running or paused', () => {
    const { state, effects } = run([start(), { type: 'SNAPSHOT', now: T0 + 2000 }]);
    expect(of(effects, 'savePlanSnapshot').at(-1)!.plan.segments[0].elapsedAtLastUpdate).toBe(2);
    expect(state.lastSnapshotAt).toBe(T0 + 2000);

    const paused = run([{ type: 'PAUSE', now: T0 + 3000 }], state).state;
    const flushed = transition(paused, { type: 'SNAPSHOT', now: T0 + 9000 }, deps());
    expect(of(flushed.effects, 'savePlanSnapshot')[0].plan.segments[0].elapsedAtLastUpdate).toBe(3);
  });

  it('has nothing to save when idle or complete', () => {
    expect(transition(initialFocusState, { type: 'SNAPSHOT', now: T0 }, deps()).effects).toEqual(
      [],
    );
    const complete = run([start(1), { type: 'TICK', now: T0 + MIN }]).state;
    expect(transition(complete, { type: 'SNAPSHOT', now: T0 + MIN }, deps()).effects).toEqual([]);
  });
});

describe('FAST_FORWARD', () => {
  it('jumps ahead but always leaves the last second', () => {
    const { state } = run([start(1), { type: 'FAST_FORWARD', now: T0, seconds: 30 }]);
    expect(remainingSeconds(state, T0)).toBe(30);
    const again = run([{ type: 'FAST_FORWARD', now: T0, seconds: 300 }], state).state;
    expect(remainingSeconds(again, T0)).toBe(1);
  });

  it('only applies while running', () => {
    const paused = run([start(), { type: 'PAUSE', now: T0 }]).state;
    expect(transition(paused, { type: 'FAST_FORWARD', now: T0, seconds: 30 }, deps()).state).toBe(
      paused,
    );
  });
});

describe('RESUME_PLAN', () => {
  const interrupted: SessionPlan = {
    id: 'old',
    createdAt: T0 - 10 * MIN,
    status: 'interrupted',
    currentSegmentIndex: 1,
    settings: { focusDuration: 25, shortBreakDuration: 5 },
    segments: [
      {
        id: 'a',
        index: 0,
        type: SessionType.FOCUS,
        plannedDuration: 1500,
        actualDuration: 1500,
        expectedStartTime: 0,
        expectedEndTime: 0,
        actualStartTime: 0,
        actualEndTime: 0,
        status: 'completed',
        pausedTime: 0,
        elapsedAtLastUpdate: 1500,
      },
      {
        id: 'b',
        index: 1,
        type: SessionType.SHORT_BREAK,
        plannedDuration: 300,
        actualDuration: null,
        expectedStartTime: 0,
        expectedEndTime: 0,
        actualStartTime: 0,
        actualEndTime: null,
        status: 'in_progress',
        pausedTime: 0,
        elapsedAtLastUpdate: 120,
      },
      {
        id: 'c',
        index: 2,
        type: SessionType.FOCUS,
        plannedDuration: 1500,
        actualDuration: null,
        expectedStartTime: 0,
        expectedEndTime: 0,
        actualStartTime: null,
        actualEndTime: null,
        status: 'pending',
        pausedTime: 0,
        elapsedAtLastUpdate: 0,
      },
    ],
    expectedEndTime: 0,
    actualEndTime: null,
    interruptedAt: T0 - MIN,
    totalPlannedDuration: 3300,
    totalElapsed: 1620,
    lastUpdated: T0 - MIN,
  };

  it('continues the unfinished work and retires the old plan', () => {
    const { state, effects } = run([{ type: 'RESUME_PLAN', now: T0, plan: interrupted }]);
    expect(state.phase).toBe('running');
    expect(state.plan!.segments.map((s) => [s.type, s.plannedDuration])).toEqual([
      [SessionType.SHORT_BREAK, 180], // what was left of the break
      [SessionType.FOCUS, 1500],
    ]);

    const saved = of(effects, 'savePlan').map((e) => e.plan);
    const old = saved.find((p) => p.id === 'old')!;
    expect(old.status).toBe('interrupted');
    expect(old.segments.map((s) => s.status)).toEqual(['completed', 'skipped', 'skipped']);
    expect(old.segments[1].actualDuration).toBe(120);
    expect(old.totalElapsed).toBe(1620);
    expect(of(effects, 'notify')[0].notification.title).toBe('Session Resumed');
  });

  it('does nothing when no work is left or a session is running', () => {
    const finished = {
      ...interrupted,
      segments: interrupted.segments.map((s) => ({ ...s, status: 'completed' as const })),
    };
    expect(run([{ type: 'RESUME_PLAN', now: T0, plan: finished }]).state).toBe(initialFocusState);
    const running = run([start()]).state;
    expect(
      transition(running, { type: 'RESUME_PLAN', now: T0, plan: interrupted }, deps()).state,
    ).toBe(running);
  });
});
