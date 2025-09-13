import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useTasks } from "../hooks/useTasks";
import { useSessions } from "../hooks/useSessions";
import { useTimer } from "../hooks/useTimer";
import { createStorageService } from "@/services/storage";
import {
  notificationService,
  NotificationService,
} from "@/services/notification";
import { SessionItem } from "../types";

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

  const handleSessionComplete = useCallback(() => {
    const completedSession = sessions.getCurrentSession();
    if (!completedSession) return;

    const updatedTasks = [...tasks.tasks];
    const currentTask = updatedTasks[tasks.currentTaskIndex];

    if (currentTask) {
      currentTask.sessions = [
        ...(currentTask.sessions || []),
        completedSession as SessionItem,
      ];
      tasks.setTasks(updatedTasks);
    }

    if (sessions.currentSessionIndex < sessions.sessions.length - 1) {
      sessions.setCurrentSessionIndex((prev) => prev + 1);
      setTimeout(() => {
        timerRef.current?.startTimer();
      }, 300);
    } else {
      notification.show("All Sessions Complete!", {
        body: "Great job finishing all sessions!",
      });
    }
  }, [tasks, sessions, notification]);

  const timer = useTimer(
    sessions.sessions,
    sessions.currentSessionIndex,
    sessions.updateSession,
    handleSessionComplete
  );
  timerRef.current = timer;

  useEffect(() => {
    if (tasks.tasks.length) {
        const currentTask = tasks.tasks[tasks.currentTaskIndex] || tasks.tasks[0];
        sessions.createNewSessions(currentTask.durationInMinutes);
    }
  }, [tasks.tasks, tasks.currentTaskIndex]);

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
