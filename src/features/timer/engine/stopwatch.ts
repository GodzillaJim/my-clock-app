/** The stopwatch tool as a pure state machine: TOGGLE starts/pauses, LAP records, RESET clears. */
import {
  isClockRunning,
  readClock,
  startClock,
  stopClock,
  stoppedClock,
  type Clock,
} from './clock';

export interface Lap {
  id: number;
  /** Stopwatch reading when the lap was taken (ms). */
  time: number;
  /** Length of this lap (ms). */
  lapDuration: number;
}

export interface StopwatchState {
  clock: Clock;
  /** Newest first. */
  laps: Lap[];
}

export type StopwatchEvent =
  { type: 'TOGGLE'; now: number } | { type: 'LAP'; now: number } | { type: 'RESET' };

export const initialStopwatchState: StopwatchState = { clock: stoppedClock, laps: [] };

export const stopwatchElapsedMs = (state: StopwatchState, now: number) =>
  readClock(state.clock, now);

export const isStopwatchRunning = (state: StopwatchState) => isClockRunning(state.clock);

export function stopwatchTransition(state: StopwatchState, event: StopwatchEvent): StopwatchState {
  switch (event.type) {
    case 'TOGGLE':
      return {
        ...state,
        clock: isClockRunning(state.clock)
          ? stopClock(state.clock, event.now)
          : startClock(state.clock, event.now),
      };
    case 'LAP': {
      if (!isClockRunning(state.clock)) return state;
      const time = readClock(state.clock, event.now);
      const previous = state.laps[0]?.time ?? 0;
      return {
        ...state,
        laps: [{ id: state.laps.length + 1, time, lapDuration: time - previous }, ...state.laps],
      };
    }
    case 'RESET':
      return initialStopwatchState;
  }
}
