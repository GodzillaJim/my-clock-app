import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  currentSegment,
  initialFocusState,
  isBreakSegment,
  planEndsAt,
  progressPercent,
  remainingSeconds,
  transition,
  type FocusEffect,
  type FocusEvent,
  type FocusState,
} from '@/features/timer/engine/focusMachine';
import type { PlanSettings } from '@/features/timer/engine/plan';
import type { SessionPlan } from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { notificationService } from '@/services/notificationService';
import { persistenceService } from '@/services/persistenceService';
import { createLogger } from '@/services/logger';
import { useTickSound } from './useTickSound';

const log = createLogger('useFocusTimer');

/** How often the clock is sampled while running. */
const TICK_MS = 250;

/** Carries out one side effect requested by the timer machine. */
export function runFocusEffect(effect: FocusEffect): void {
  switch (effect.type) {
    case 'savePlan':
      focusStorage
        .saveSessionPlan(effect.plan)
        .catch((err) => log.error('Failed to save plan:', err));
      break;
    case 'savePlanSnapshot':
      persistenceService.savePlanSnapshot(effect.plan);
      break;
    case 'clearPlanSnapshot':
      persistenceService.clearPlanSnapshot();
      break;
    case 'recordSession':
      focusStorage
        .addSession(effect.record)
        .catch((err) => log.error('Failed to save session record:', err));
      break;
    case 'notify':
      notificationService.showNotification({ ...effect.notification, timestamp: new Date() });
      break;
    case 'recalculateStats':
      focusStorage
        .recalculateLifetimeStats()
        .catch((err) => log.error('Failed to recalculate stats:', err));
      break;
  }
}

/**
 * React binding for the focus timer machine: holds its state, samples the
 * clock while running, and runs the side effects each transition returns.
 * Components only read the derived values and call the actions.
 */
export function useFocusTimer() {
  const [state, setState] = useState<FocusState>(initialFocusState);
  const stateRef = useRef(state);
  const [now, setNow] = useState(() => Date.now());

  const dispatch = useCallback((event: FocusEvent) => {
    const { state: next, effects } = transition(stateRef.current, event, { newId: uuidv4 });
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
    setNow('now' in event ? event.now : Date.now());
    effects.forEach(runFocusEffect);
  }, []);

  // Leaving the page (reload, quit, crash recovery): keep the latest progress
  useEffect(() => {
    const flush = () => dispatch({ type: 'SNAPSHOT', now: Date.now() });
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [dispatch]);

  const running = state.phase === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), TICK_MS);
    return () => clearInterval(id);
  }, [running, dispatch]);

  const actions = useMemo(
    () => ({
      start: (totalMinutes: number, settings: PlanSettings) =>
        dispatch({ type: 'START', now: Date.now(), totalMinutes, settings }),
      resumePlan: (plan: SessionPlan) => dispatch({ type: 'RESUME_PLAN', now: Date.now(), plan }),
      pause: () => dispatch({ type: 'PAUSE', now: Date.now() }),
      resume: () => dispatch({ type: 'RESUME', now: Date.now() }),
      skip: () => dispatch({ type: 'SKIP', now: Date.now() }),
      stop: () => dispatch({ type: 'STOP', now: Date.now() }),
      reset: () => dispatch({ type: 'RESET' }),
      /** Save the crash-recovery snapshot immediately. */
      flushSnapshot: () => dispatch({ type: 'SNAPSHOT', now: Date.now() }),
      fastForward: (seconds = 30) => dispatch({ type: 'FAST_FORWARD', now: Date.now(), seconds }),
    }),
    [dispatch],
  );

  const segment = currentSegment(state);
  const remaining = remainingSeconds(state, now);
  useTickSound(remaining, running);

  return {
    phase: state.phase,
    isRunning: running,
    isPaused: state.phase === 'paused',
    isComplete: state.phase === 'complete',
    /** A plan is in progress (running or paused). */
    hasSession: state.phase === 'running' || state.phase === 'paused',
    isBreak: isBreakSegment(segment),
    segmentIndex: state.index,
    segmentCount: state.plan?.segments.length ?? 0,
    /** Segments of the plan in progress (empty when idle or complete). */
    segments: (running || state.phase === 'paused') && state.plan ? state.plan.segments : [],
    remainingSeconds: remaining,
    progress: progressPercent(state, now),
    segmentEndsAt: now + remaining * 1000,
    planEndsAt: planEndsAt(state, now),
    actions,
  };
}
