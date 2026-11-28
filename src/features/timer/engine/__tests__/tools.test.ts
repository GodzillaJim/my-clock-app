import { describe, expect, it } from 'vitest';
import { readClock, startClock, stopClock, stoppedClock } from '../clock';
import {
  countdownProgress,
  countdownRemainingSeconds,
  countdownTransition,
  initialCountdownState,
  type CountdownEvent,
  type CountdownState,
} from '../countdown';
import {
  initialStopwatchState,
  isStopwatchRunning,
  stopwatchElapsedMs,
  stopwatchTransition,
} from '../stopwatch';
import { formatClock } from '../format';
import { splitIntoSegments } from '../plan';
import { SessionType } from '../../types';

const T0 = 1_000_000;

describe('clock', () => {
  it('measures running spans against wall time', () => {
    const running = startClock(stoppedClock, T0);
    expect(readClock(running, T0 + 1234)).toBe(1234);
    expect(startClock(running, T0 + 999)).toBe(running); // already running

    const stopped = stopClock(running, T0 + 2000);
    expect(readClock(stopped, T0 + 9000)).toBe(2000);
    expect(stopClock(stopped, T0 + 9000)).toBe(stopped); // already stopped

    expect(readClock(startClock(stopped, T0 + 5000), T0 + 6000)).toBe(3000);
  });
});

describe('countdown', () => {
  const run = (events: CountdownEvent[], from: CountdownState = initialCountdownState) => {
    let state = from;
    const effects: string[] = [];
    for (const e of events) {
      const r = countdownTransition(state, e);
      state = r.state;
      effects.push(...r.effects);
    }
    return { state, effects };
  };

  it('counts down, pauses and resumes', () => {
    const { state } = run([
      { type: 'START', now: T0, seconds: 60 },
      { type: 'PAUSE', now: T0 + 10_000 },
    ]);
    expect(state.phase).toBe('paused');
    expect(countdownRemainingSeconds(state, T0 + 50_000)).toBe(50);

    const resumed = run([{ type: 'RESUME', now: T0 + 50_000 }], state).state;
    expect(countdownRemainingSeconds(resumed, T0 + 60_000)).toBe(40);
    expect(countdownProgress(resumed, T0 + 60_000)).toBeCloseTo(33.33, 1);
  });

  it('finishes at zero and notifies once', () => {
    const started = run([{ type: 'START', now: T0, seconds: 5 }]).state;
    expect(countdownTransition(started, { type: 'TICK', now: T0 + 4999 }).state).toBe(started);
    const { state, effects } = run([{ type: 'TICK', now: T0 + 5000 }], started);
    expect(state).toBe(initialCountdownState);
    expect(effects).toEqual(['finished', 'cleared']);
  });

  it('resets without notifying', () => {
    const { state, effects } = run([{ type: 'START', now: T0, seconds: 5 }, { type: 'RESET' }]);
    expect(state).toBe(initialCountdownState);
    expect(effects).toEqual(['cleared']);
  });

  it('ignores events that do not apply', () => {
    const idle = initialCountdownState;
    for (const e of [
      { type: 'PAUSE', now: T0 },
      { type: 'RESUME', now: T0 },
      { type: 'TICK', now: T0 },
      { type: 'RESET' },
      { type: 'START', now: T0, seconds: 0 },
    ] as CountdownEvent[]) {
      expect(countdownTransition(idle, e).state).toBe(idle);
    }
    const running = run([{ type: 'START', now: T0, seconds: 5 }]).state;
    expect(countdownTransition(running, { type: 'START', now: T0, seconds: 9 }).state).toBe(
      running,
    );
    expect(countdownTransition(running, { type: 'RESUME', now: T0 }).state).toBe(running);
    expect(countdownRemainingSeconds(idle, T0)).toBe(0);
    expect(countdownProgress(idle, T0)).toBe(0);
  });
});

describe('stopwatch', () => {
  it('runs, pauses and keeps laps (newest first)', () => {
    let s = stopwatchTransition(initialStopwatchState, { type: 'TOGGLE', now: T0 });
    expect(isStopwatchRunning(s)).toBe(true);
    s = stopwatchTransition(s, { type: 'LAP', now: T0 + 1500 });
    s = stopwatchTransition(s, { type: 'LAP', now: T0 + 4000 });
    expect(s.laps).toEqual([
      { id: 2, time: 4000, lapDuration: 2500 },
      { id: 1, time: 1500, lapDuration: 1500 },
    ]);

    s = stopwatchTransition(s, { type: 'TOGGLE', now: T0 + 5000 });
    expect(isStopwatchRunning(s)).toBe(false);
    expect(stopwatchElapsedMs(s, T0 + 60_000)).toBe(5000);
    expect(stopwatchTransition(s, { type: 'LAP', now: T0 + 6000 })).toBe(s); // no laps while paused

    expect(stopwatchTransition(s, { type: 'RESET' })).toBe(initialStopwatchState);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [59, '00:59'],
    [1500, '25:00'],
    [3600, '1:00:00'],
    [5400, '1:30:00'],
    [-5, '00:00'],
  ])('%i s → %s', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});

describe('splitIntoSegments', () => {
  it('alternates focus and break, never exceeding the total', () => {
    const specs = splitIntoSegments(65, { focusDuration: 25, shortBreakDuration: 5 });
    expect(specs.map((s) => s.duration / 60)).toEqual([25, 5, 25, 5, 5]);
    expect(specs.map((s) => s.type)).toEqual([
      SessionType.FOCUS,
      SessionType.SHORT_BREAK,
      SessionType.FOCUS,
      SessionType.SHORT_BREAK,
      SessionType.FOCUS,
    ]);
  });

  it('returns nothing for a zero or negative total', () => {
    expect(splitIntoSegments(0, { focusDuration: 25, shortBreakDuration: 5 })).toEqual([]);
    expect(splitIntoSegments(-3, { focusDuration: 25, shortBreakDuration: 5 })).toEqual([]);
  });
});
