/**
 * A pausable clock measured against wall time, so readings stay exact however
 * late timers fire (unlike adding a fixed step per interval).
 */
export interface Clock {
  /** Milliseconds accumulated before `runningSince`. */
  elapsedMs: number;
  /** Start of the current running span; null while stopped. */
  runningSince: number | null;
}

export const stoppedClock: Clock = { elapsedMs: 0, runningSince: null };

export const isClockRunning = (clock: Clock) => clock.runningSince !== null;

export function readClock(clock: Clock, now: number): number {
  return (
    clock.elapsedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince))
  );
}

export function startClock(clock: Clock, now: number): Clock {
  return clock.runningSince === null ? { ...clock, runningSince: now } : clock;
}

export function stopClock(clock: Clock, now: number): Clock {
  return clock.runningSince === null
    ? clock
    : { elapsedMs: readClock(clock, now), runningSince: null };
}
