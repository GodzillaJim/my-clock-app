import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  countdownProgress,
  countdownRemainingSeconds,
  countdownTransition,
  initialCountdownState,
  type CountdownEvent,
} from '@/features/timer/engine/countdown';
import {
  initialStopwatchState,
  isStopwatchRunning,
  stopwatchElapsedMs,
  stopwatchTransition,
  type StopwatchEvent,
} from '@/features/timer/engine/stopwatch';
import { notificationService } from '@/services/notificationService';
import { persistenceService } from '@/services/persistenceService';
import { useTickSound } from './useTickSound';

const TIMER_SNAPSHOT_KEY = 'TIMER_SNAPSHOT';
const STOPWATCH_SNAPSHOT_KEY = 'STOPWATCH_SNAPSHOT';

/** Re-samples the clock every `intervalMs` while `active`; returns the latest reading. */
function useNow(active: boolean, intervalMs: number): [number, (now: number) => void] {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return [now, setNow];
}

/** The countdown tool: a single pausable countdown that notifies when it ends. */
export function useCountdown() {
  const [state, setState] = useState(initialCountdownState);
  const stateRef = useRef(state);
  const running = state.phase === 'running';
  const [now, setNow] = useNow(running, 250);

  const dispatch = useCallback(
    (event: CountdownEvent) => {
      const { state: next, effects } = countdownTransition(stateRef.current, event);
      stateRef.current = next;
      setState(next);
      setNow('now' in event ? event.now : Date.now());
      if (effects.includes('cleared')) persistenceService.clearSnapshot(TIMER_SNAPSHOT_KEY);
      if (effects.includes('finished')) {
        notificationService.showNotification({
          type: 'session_complete',
          title: 'Timer Complete',
          body: 'Your countdown timer has finished!',
          timestamp: new Date(),
        });
      }
    },
    [setNow],
  );

  // Each clock sample is also a TICK, so the end is detected promptly
  useEffect(() => {
    if (running) dispatch({ type: 'TICK', now });
  }, [running, now, dispatch]);

  const remaining = countdownRemainingSeconds(state, now);
  useTickSound(remaining, running);

  const actions = useMemo(
    () => ({
      start: (seconds: number) => dispatch({ type: 'START', now: Date.now(), seconds }),
      pause: () => dispatch({ type: 'PAUSE', now: Date.now() }),
      resume: () => dispatch({ type: 'RESUME', now: Date.now() }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [dispatch],
  );

  return {
    isActive: state.phase !== 'idle',
    isRunning: running,
    isPaused: state.phase === 'paused',
    remainingSeconds: remaining,
    progress: countdownProgress(state, now),
    endsAt: now + remaining * 1000,
    actions,
  };
}

/** The stopwatch tool, with laps. */
export function useStopwatch() {
  const [state, setState] = useState(initialStopwatchState);
  const running = isStopwatchRunning(state);
  const [now, setNow] = useNow(running, 31);

  const dispatch = useCallback(
    (event: StopwatchEvent) => {
      setState((prev) => stopwatchTransition(prev, event));
      setNow('now' in event ? event.now : Date.now());
      if (event.type === 'RESET') persistenceService.clearSnapshot(STOPWATCH_SNAPSHOT_KEY);
    },
    [setNow],
  );

  const actions = useMemo(
    () => ({
      toggle: () => dispatch({ type: 'TOGGLE', now: Date.now() }),
      lap: () => dispatch({ type: 'LAP', now: Date.now() }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [dispatch],
  );

  return {
    isRunning: running,
    elapsedMs: stopwatchElapsedMs(state, now),
    laps: state.laps,
    actions,
  };
}
