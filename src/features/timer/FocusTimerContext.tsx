import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useFocusTimer } from './hooks/useFocusTimer';
import type { PlanSettings } from './engine/plan';

type FocusTimer = ReturnType<typeof useFocusTimer>;

export interface FocusTimerContextValue extends FocusTimer {
  /** Length of the next session, as chosen with the presets (minutes). */
  plannedMinutes: number;
  setPlannedMinutes: (minutes: number) => void;
  /**
   * Start the planned session, or continue a paused one. A finished session
   * is cleared first. Does nothing while running. Stable across renders.
   */
  startOrResume: (settings: PlanSettings) => void;
  /** Space-bar behaviour: pause when running, otherwise `startOrResume`. Stable. */
  toggle: (settings: PlanSettings) => void;
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

/**
 * Owns the one focus timer of the app, above every layout, so tray actions,
 * shortcuts and keyboard can drive it and switching views never drops a
 * running session.
 */
export const FocusTimerProvider: React.FC<{
  children: React.ReactNode;
  /** Starting value for `plannedMinutes`; App then keeps it in step with the setting. */
  initialMinutes?: number;
}> = ({ children, initialMinutes = 25 }) => {
  const timer = useFocusTimer();
  const [plannedMinutes, setPlannedMinutes] = useState(initialMinutes);

  // Latest values for the stable callbacks below
  const latest = useRef({ timer, plannedMinutes });
  latest.current = { timer, plannedMinutes };

  const startOrResume = useCallback((settings: PlanSettings) => {
    const { timer: t, plannedMinutes: minutes } = latest.current;
    if (t.phase === 'paused') return t.actions.resume();
    if (t.phase === 'complete') t.actions.reset();
    if (t.phase !== 'running') t.actions.start(minutes, settings);
  }, []);

  const toggle = useCallback(
    (settings: PlanSettings) => {
      const { timer: t } = latest.current;
      if (t.phase === 'running') t.actions.pause();
      else startOrResume(settings);
    },
    [startOrResume],
  );

  const value = useMemo(
    () => ({ ...timer, plannedMinutes, setPlannedMinutes, startOrResume, toggle }),
    [timer, plannedMinutes, startOrResume, toggle],
  );

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
};

export function useFocusTimerContext(): FocusTimerContextValue {
  const value = useContext(FocusTimerContext);
  if (!value) throw new Error('useFocusTimerContext must be used inside <FocusTimerProvider>');
  return value;
}
