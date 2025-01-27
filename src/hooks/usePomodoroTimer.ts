import { TaskType } from "@/components/tasks/TaskList";
import { useState, useEffect, useCallback, useRef } from "react";
import { v4 } from "uuid";

type SessionType = "focus" | "shortBreak" | "longBreak";

interface PomodoroSession {
  id: string;
  type: SessionType;
  duration: number;
  sessionNumber?: number;
}

interface PomodoroState {
  sessions: PomodoroSession[];
  currentSessionIndex: number;
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  totalTimeElapsed: number;
}

interface UsePomodoroTimer {
  // State
  tasks: TaskType[];

  // Actions
  setTasks: (tasks: TaskType[]) => void;
}

export const usePomodoroTimer = (): UsePomodoroTimer => {

  // Constants
  const FOCUS_SESSION = 25;
  const SHORT_BREAK = 5;
  const LONG_BREAK = 15;
  const SESSIONS_BEFORE_LONG_BREAK = 4;

  // Set total minutes
  const [totalMinutes, setTotalMinutes] = useState(15);

  // Calculate initial sessions
  const calculateSessions = useCallback((task: TaskType): PomodoroSession[] => {
    const sessions: PomodoroSession[] = [];
    let remainingMinutes = task.durationInMinutes;
    let focusSessionCount = 0;

    while (remainingMinutes > 0) {
      // Add focus session
      if (remainingMinutes >= FOCUS_SESSION) {
        sessions.push({
          id: v4(),
          type: "focus",
          duration: FOCUS_SESSION,
          sessionNumber: focusSessionCount + 1,
        });
        remainingMinutes -= FOCUS_SESSION;
        focusSessionCount++;
      } else {
        sessions.push({
          id: v4(),
          type: "focus",
          duration: remainingMinutes,
          sessionNumber: focusSessionCount + 1,
        });
        break;
      }

      if (remainingMinutes > 0) {
        if (focusSessionCount % SESSIONS_BEFORE_LONG_BREAK === 0) {
          // Add long break
          if (remainingMinutes >= LONG_BREAK) {
            sessions.push({
              id: v4(),
              type: "longBreak",
              duration: LONG_BREAK,
            });
            remainingMinutes -= LONG_BREAK;
          } else {
            sessions.push({
              id: v4(),
              type: "longBreak",
              duration: remainingMinutes,
            });
            break;
          }
        } else {
          // Add short break
          if (remainingMinutes >= SHORT_BREAK) {
            sessions.push({
              id: v4(),
              type: "shortBreak",
              duration: SHORT_BREAK,
            });
            remainingMinutes -= SHORT_BREAK;
          } else {
            sessions.push({
              id: v4(),
              type: "shortBreak",
              duration: remainingMinutes,
            });
            break;
          }
        }
      }
    }

    return sessions;
  }, [totalMinutes]);

  // State
  const [state, setState] = useState<PomodoroState>({
    sessions: [],
    currentSessionIndex: 0,
    timeRemaining: 0, // Convert to seconds
    isRunning: false,
    isPaused: false,
    totalTimeElapsed: 0,
  });

  const [activeTask, setActiveTask] = useState<TaskType | null>(null);

  // Refs
  const timerRef = useRef<NodeJS.Timeout>();

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer tick handler
  const tick = useCallback(() => {
    setState((prevState) => {
      if (prevState.timeRemaining <= 0) {
        // Move to next session if available
        if (prevState.currentSessionIndex < prevState.sessions.length - 1) {
          const nextIndex = prevState.currentSessionIndex + 1;
          return {
            ...prevState,
            currentSessionIndex: nextIndex,
            timeRemaining: prevState.sessions[nextIndex].duration * 60,
            totalTimeElapsed: prevState.totalTimeElapsed + 1,
          };
        } else {
          // End of all sessions
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return {
            ...prevState,
            isRunning: false,
            isPaused: false,
          };
        }
      }

      return {
        ...prevState,
        timeRemaining: prevState.timeRemaining - 1,
        totalTimeElapsed: prevState.totalTimeElapsed + 1,
      };
    });
  }, []);

  // Timer control actions
  const startTimer = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true, isPaused: false }));
    timerRef.current = setInterval(tick, 1000);
  }, [tick]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setState((prev) => ({ ...prev, isRunning: false, isPaused: true }));
  }, []);

  const resumeTimer = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true, isPaused: false }));
    timerRef.current = setInterval(tick, 1000);
  }, [tick]);

  const resetTimer = useCallback(() => {
    if (!activeTask) return
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setState({
      sessions: calculateSessions(activeTask),
      currentSessionIndex: 0,
      timeRemaining: calculateSessions(activeTask)[0]?.duration * 60 || 0,
      isRunning: false,
      isPaused: false,
      totalTimeElapsed: 0,
    });
  }, [calculateSessions]);

  const resetCurrentSession = useCallback(() => {
    const thisSession = state.sessions[state.currentSessionIndex];
    console.log('ThisSession: ', thisSession);
    setState((prev) => ({
      ...prev,
      timeRemaining: prev.sessions[prev.currentSessionIndex].duration * 60,
      isRunning: false,
      isPaused: false,
    }));

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [state.currentSessionIndex]);

  const skipToNextSession = useCallback(() => {
    setState((prev) => {
      if (prev.currentSessionIndex < prev.sessions.length - 1) {
        const nextIndex = prev.currentSessionIndex + 1;
        return {
          ...prev,
          currentSessionIndex: nextIndex,
          timeRemaining: prev.sessions[nextIndex].duration * 60,
          isRunning: false,
          isPaused: false,
        };
      }
      return prev;
    });
  }, []);

  // Calculate current session progress
  const currentSessionProgress =
    ((state.sessions[state.currentSessionIndex]?.duration * 60 -
      state.timeRemaining) /
      (state.sessions[state.currentSessionIndex]?.duration * 60)) *
    100;

  return {
    tasks: [],
    setTasks: () => {},
  };
};
