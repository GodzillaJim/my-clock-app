import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useTasks } from "../hooks/useTasks";
import { useSessions } from "../hooks/useSessions";
import { useTimer } from "../hooks/useTimer";
import { createStorageService } from "@/services/storage";
import {
  notificationService,
  NotificationService,
} from "@/services/notification";

type TimerContextType = ReturnType<typeof useTasks> &
  ReturnType<typeof useSessions> & {
    timer: ReturnType<typeof useTimer>;
    storage: ReturnType<typeof createStorageService>;
    notification: NotificationService;
  };

const TimerContext = createContext<TimerContextType | null>(null);

export const TimerProvider = ({ children }: { children: React.ReactNode }) => {
  const tasks = useTasks();
  const sessions = useSessions();
  const storage = useMemo(() => createStorageService("pomodoro"), []);
  const notification = useMemo(() => notificationService, []);

  const timerRef = React.useRef<ReturnType<typeof useTimer> | null>(null);

  // Assign timer to ref after creation
  const timer = useTimer(
    sessions.sessions,
    sessions.currentSessionIndex,
    sessions.updateSession,
    handleSessionComplete
    const storage = useMemo(() => createStorageService("pomodoro"), []);
    const notification = useMemo(() => notificationService, []);
    const timerRef = React.useRef<ReturnType<typeof useTimer> | null>(null);
    const [shouldAutoStart, setShouldAutoStart] = React.useState(false);

    // Assign timer to ref after creation
    const timer = useTimer(
      sessions.sessions,
      sessions.currentSessionIndex,
      sessions.updateSession,
      () => {
        // This callback will be replaced by handleSessionComplete below
      }
    );
    timerRef.current = timer;

    // Auto-start effect
    React.useEffect(() => {
      if (shouldAutoStart) {
        timerRef.current?.startTimer();
        setShouldAutoStart(false);
      }
    }, [shouldAutoStart]);
      currentTask.sessions = [
        ...(currentTask.sessions || []),
        completedSession,
      ];
      tasks.setTasks(updatedTasks);
    }

    // Move to next session if available
    if (sessions.currentSessionIndex < sessions.sessions.length - 1) {
      sessions.setCurrentSessionIndex((prev) => prev + 1);
      // Auto-start the next session
      setTimeout(() => {
        timerRef.current?.startTimer();
      }, 300); // Small delay to allow state update
    } else {
      // All sessions complete - stop the timer
      notification.show("All Sessions Complete!", {
        body: "Great job finishing all sessions!",
      });
      // Don't automatically move to next task - let user decide
    }
  }, [tasks, sessions, notification]);

  const timer = useTimer(
    sessions.sessions,
    sessions.currentSessionIndex,
    sessions.updateSession,
    handleSessionComplete
    // Patch timer's onSessionEnd to use the correct callback
    React.useEffect(() => {
      if (timerRef.current) {
        timerRef.current.onSessionEnd = handleSessionComplete;
      }
    }, [handleSessionComplete]);
  );

  useEffect(() => {
    if (tasks.tasks.length) {
        const currentTask = tasks.tasks[tasks.currentTaskIndex] || tasks.tasks[0];
        sessions.createNewSessions(currentTask.durationInMinutes);
    }
  }, [tasks])

  const value = useMemo(
    () => ({
      ...tasks,
      ...sessions,
      timer,
      storage,
      notification,
    }),
    [tasks, sessions, timer, storage, notification]
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
};

export const useTimerContext = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimerContext must be used within a TimerProvider");
  }
  return context;
};
