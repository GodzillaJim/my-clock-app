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

  const handleSessionComplete = useCallback(() => {
    // Update task with completed session
    const updatedTasks = [...tasks.tasks];
    const currentTask = updatedTasks[tasks.currentTaskIndex];

    if (currentTask) {
      const completedSession = sessions.sessions[sessions.currentSessionIndex];
      currentTask.sessions = [
        ...(currentTask.sessions || []),
        completedSession,
      ];
      tasks.setTasks(updatedTasks);
    }

    // Move to next session if available
    if (sessions.currentSessionIndex < sessions.sessions.length - 1) {
      sessions.setCurrentSessionIndex((prev) => prev + 1);
    } else {
      // Handle task completion
      notification.show("Task Complete!", {
        body: "Great job finishing the task!",
      });
      tasks.setCurrentTaskIndex(
        Math.min(tasks.currentTaskIndex + 1, tasks.tasks.length - 1)
      );
    }
  }, [tasks, sessions, notification]);

  const timer = useTimer(
    sessions.sessions,
    sessions.currentSessionIndex,
    sessions.updateSession,
    handleSessionComplete
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
