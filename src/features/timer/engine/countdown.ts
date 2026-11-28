/**
 * The countdown tool as a pure state machine:
 * idle ──START──▶ running ⇄ paused; TICK at zero ──▶ idle (+ `finished`); RESET ──▶ idle.
 */
import { readClock, startClock, stopClock, stoppedClock, type Clock } from './clock';

export type CountdownPhase = 'idle' | 'running' | 'paused';

export interface CountdownState {
  phase: CountdownPhase;
  durationMs: number;
  clock: Clock;
}

export type CountdownEvent =
  | { type: 'START'; now: number; seconds: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'RESET' };

export type CountdownEffect = 'finished';

export const initialCountdownState: CountdownState = {
  phase: 'idle',
  durationMs: 0,
  clock: stoppedClock,
};

export function countdownRemainingMs(state: CountdownState, now: number): number {
  if (state.phase === 'idle') return 0;
  return Math.max(0, state.durationMs - readClock(state.clock, now));
}

/** Whole seconds left, rounded up. */
export function countdownRemainingSeconds(state: CountdownState, now: number): number {
  return Math.ceil(countdownRemainingMs(state, now) / 1000);
}

export function countdownProgress(state: CountdownState, now: number): number {
  if (state.phase === 'idle' || state.durationMs <= 0) return 0;
  return Math.max(0, Math.min(100, (readClock(state.clock, now) / state.durationMs) * 100));
}

export function countdownTransition(
  state: CountdownState,
  event: CountdownEvent,
): { state: CountdownState; effects: CountdownEffect[] } {
  const same = { state, effects: [] as CountdownEffect[] };
  switch (event.type) {
    case 'START':
      if (state.phase !== 'idle' || event.seconds <= 0) return same;
      return {
        state: {
          phase: 'running',
          durationMs: event.seconds * 1000,
          clock: startClock(stoppedClock, event.now),
        },
        effects: [],
      };
    case 'PAUSE':
      if (state.phase !== 'running') return same;
      return {
        state: { ...state, phase: 'paused', clock: stopClock(state.clock, event.now) },
        effects: [],
      };
    case 'RESUME':
      if (state.phase !== 'paused') return same;
      return {
        state: { ...state, phase: 'running', clock: startClock(state.clock, event.now) },
        effects: [],
      };
    case 'TICK':
      if (state.phase !== 'running' || countdownRemainingMs(state, event.now) > 0) return same;
      return { state: initialCountdownState, effects: ['finished'] };
    case 'RESET':
      if (state.phase === 'idle') return same;
      return { state: initialCountdownState, effects: [] };
  }
}
