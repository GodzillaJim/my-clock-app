// src/features/timer/hooks/useTimer.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { TimerState, CompletionStatus, type SessionItem, type ServiceError } from "../types";
import { notificationService } from "@/services/notification";

const PRECISION = 100; // Update interval in ms
const SAVE_INTERVAL = 5000; // Auto-save interval in ms

export const useTimer = (
  sessions: SessionItem[],
  currentSessionIndex: number = 0,
  updateSession: (sessionId: string, updates: Partial<SessionItem>) => void,
  onSessionEnd: () => void
) => {
  const [timerState, setTimerState] = useState<TimerState>(TimerState.IDLE);
  const [error, setError] = useState<ServiceError | null>(null);
  const notification = notificationService;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const currentSession = sessions[currentSessionIndex];

  const validateSession = useCallback(() => {
    if (!currentSession || currentSession.remainingMinutes <= 0) {
      setError({
        origin: "timer",
        error: new Error("Invalid session state"),
        context: { currentSession },
        timestamp: new Date(),
      });
      return false;
    }
    return true;
  }, [currentSession]);

  const calculateRemaining = useCallback(
    (elapsed: number): number => {
      const totalSeconds = currentSession.minutes * 60;
      return Math.max(0, totalSeconds - elapsed);
    },
    [currentSession?.minutes]
  );

  const updateTimerDisplay = useCallback(
    (remainingSeconds: number) => {
      const remainingMinutes = remainingSeconds / 60;
      updateSession(currentSession.id, {
        remainingMinutes: parseFloat(remainingMinutes.toFixed(2)),
      });
    },
    [currentSession?.id, updateSession]
  );

  const handleSessionEnd = useCallback(async () => {
    clearInterval(intervalRef.current!);
    setTimerState(TimerState.COMPLETED);

    // Update session completion
    updateSession(currentSession.id, {
      completedAt: new Date(),
      remainingMinutes: 0,
    });

    // Trigger notifications
    try {
      await notification.show("Session Complete", {
        body: `Time's up! ${currentSession.type} session finished.`,
      });
    } catch (err) {
      setError({
        origin: "notification",
        error: err as Error,
        context: { session: currentSession },
        timestamp: new Date(),
      });
    }

    onSessionEnd();
  }, [currentSession, notification, onSessionEnd, updateSession]);

  const tick = useCallback(() => {
    if (!currentSession) return;

    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const remainingSeconds = calculateRemaining(elapsed);

    if (remainingSeconds <= 0) {
      handleSessionEnd();
    } else {
      updateTimerDisplay(remainingSeconds);
    }
  }, [
    calculateRemaining,
    currentSession,
    handleSessionEnd,
    updateTimerDisplay,
  ]);

  // Auto-save progress
  useEffect(() => {
    if (timerState === TimerState.RUNNING) {
      const saveInterval = setInterval(() => {
        // Persist current state to storage
        elapsedRef.current = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );
      }, SAVE_INTERVAL);

      return () => clearInterval(saveInterval);
    }
  }, [timerState]);

  // Precision timing control
  useEffect(() => {
    if (timerState === TimerState.RUNNING) {
      intervalRef.current = setInterval(tick, PRECISION);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [timerState, tick]);

  const startTimer = useCallback(() => {
    if (!validateSession()) return;

    setTimerState(TimerState.RUNNING);
    startTimeRef.current = Date.now() - elapsedRef.current * 1000;
  }, [validateSession]);

  const pauseTimer = useCallback(() => {
    setTimerState(TimerState.PAUSED);
    pauseTimeRef.current = Date.now();
    elapsedRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  const resumeTimer = useCallback(() => {
    if (!validateSession()) return;

    setTimerState(TimerState.RUNNING);
    startTimeRef.current = Date.now() - elapsedRef.current * 1000;
  }, [validateSession]);

  const resetTimer = useCallback(() => {
    setTimerState(TimerState.IDLE);
    elapsedRef.current = 0;
    updateSession(currentSession.id, {
      remainingMinutes: currentSession.minutes,
    });
  }, [currentSession?.id, currentSession?.minutes, updateSession]);

  const skipSession = useCallback(() => {
    updateSession(currentSession.id, {
      remainingMinutes: 0,
      completionStatus: CompletionStatus.SKIPPED,
    });
    handleSessionEnd();
  }, [currentSession?.id, handleSessionEnd, updateSession]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        timerState === TimerState.RUNNING
      ) {
        // Recalculate elapsed time when returning to tab
        elapsedRef.current = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );
        tick();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [tick, timerState]);

  return {
    timerState,
    error,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    skipSession,
    elapsed: elapsedRef.current,
    currentSessionProgress: currentSession
      ? 1 - currentSession.remainingMinutes / currentSession.minutes
      : 0,
  };
};
