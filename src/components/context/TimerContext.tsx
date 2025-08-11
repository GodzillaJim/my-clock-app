import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TaskType } from "../tasks/TaskList";
import { v4 } from "uuid";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createStorageService } from "@/services/storage";
import { 
  SessionRecord, 
  SessionType as TimerSessionType, 
  SessionItem,
  CompletionStatus,
  fromSessionItem,
  toSessionItem 
} from "@/features/timer/types";

dayjs.extend(duration);

export type SessionType = "focus" | "shortBreak" | "longBreak" | "completion";

// Legacy session type for internal use
type LegacySessionItem = {
  id: string;
  type: SessionType;
  minutes: number;
  sessionNumber?: number;
  remainingMinutes: number;
  skipped?: boolean;
};

type TimerContextType = {
  sessions: LegacySessionItem[];
  setSessions: React.Dispatch<React.SetStateAction<LegacySessionItem[]>>;
  currentSessionIndex: number;
  setCurrentSessionIndex: (index: number) => void;
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  handleSessionComplete?: (updatedData: LegacySessionItem[]) => void;
  tasks: TaskType[];
  setTasks: (tasks: TaskType[]) => void;
  currentTaskIndex: number;
  setCurrentTaskIndex: (index: number) => void;
  restartTask: () => void;
  restartSession: () => void;
  skipSession: () => void;
  startTimer: () => void;
};

type SessionStorageType = {
  sessions: LegacySessionItem[];
  tasks: TaskType[];
  currentTaskIndex: number;
  currentSessionIndex: number;
};

export const TimerContext = createContext<TimerContextType>({
  sessions: [],
  setSessions: () => {},
  currentSessionIndex: 0,
  setCurrentSessionIndex: () => {},
  isRunning: false,
  setIsRunning: () => {},
  tasks: [],
  setTasks: () => {},
  currentTaskIndex: 0,
  setCurrentTaskIndex: () => {},
  restartTask: () => {},
  restartSession: () => {},
  skipSession: () => {},
  startTimer: () => {},
});

export const TimerContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const [sessions, setSessions] = useState<LegacySessionItem[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const task = tasks[currentTaskIndex];

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleSessionComplete = (updatedData: LegacySessionItem[]) => {
    // If there is a next session, move forward
    if (currentSessionIndex < updatedData.length - 1) {
      setCurrentSessionIndex((prev) => prev + 1);

      // Add session to task - convert legacy session to proper SessionItem
      const updatedTasks = [...tasks];
      const currentTask = updatedTasks[currentTaskIndex];
      const legacySession = updatedData[currentSessionIndex];
      
      // Convert legacy session to SessionItem format
      const sessionItem: SessionItem = {
        ...toSessionItem({
          id: legacySession.id,
          type: legacySession.type === 'focus' ? TimerSessionType.FOCUS : 
                legacySession.type === 'shortBreak' ? TimerSessionType.SHORT_BREAK :
                legacySession.type === 'longBreak' ? TimerSessionType.LONG_BREAK : TimerSessionType.FOCUS,
          sessionNumber: legacySession.sessionNumber || 0,
          plannedDuration: legacySession.minutes,
          actualDuration: legacySession.minutes - legacySession.remainingMinutes,
          startTime: new Date(),
          endTime: new Date(),
          pausedTime: 0,
          completionStatus: legacySession.skipped ? CompletionStatus.SKIPPED : CompletionStatus.COMPLETED,
          remainingTime: legacySession.remainingMinutes * 60
        })
      };
      
      if (currentTask?.sessions) {
        currentTask.sessions.push(sessionItem);
      } else {
        currentTask.sessions = [sessionItem];
      }
      setTasks(updatedTasks);
    } else {
      // Otherwise, stop the timer since we are at the end of the session list
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (currentTaskIndex >= tasks.length) {
      setCurrentTaskIndex(Math.max(0, tasks.length - 1));
    }
  }, [tasks, currentTaskIndex]);

  useEffect(() => {
    if (currentSessionIndex >= sessions.length) {
      setCurrentSessionIndex(Math.max(0, sessions.length - 1));
    }
  }, [sessions, currentSessionIndex]);

  useEffect(() => {
    // Time effect when the timer is running
    if (isRunning) {
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setSessions((prev) => {
          const updated = [...prev];
          const currentSession = updated[currentSessionIndex];
          const elapsedSeconds = Math.floor((Date.now() - startTime!) / 1000);
          const remainingSeconds = currentSession.minutes * 60 - elapsedSeconds;

          if (remainingSeconds <= 0) {
            handleSessionComplete(updated);
            currentSession.remainingMinutes = 0;
          } else {
            currentSession.remainingMinutes = remainingSeconds / 60;
          }

          return updated;
        });
      });
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, currentSessionIndex, startTime]);

  const createSessions = (timeInMinutes: number) => {
    // Break time into 25 minute sessions
    // Add a 5 minute break after each session
    // Add a 15 minute break after 4 sessions
    // Repeat until time is up
    // Return an array of session objects
    const sessions: LegacySessionItem[] = [];
    let sessionNumber = 1;
    let remainingMinutes = timeInMinutes;
    while (remainingMinutes > 0) {
      const session: LegacySessionItem = {
        id: v4(),
        type: "focus",
        minutes: Math.min(remainingMinutes, 25),
        sessionNumber,
        remainingMinutes,
      };
      sessions.push(session);
      remainingMinutes -= session.minutes;
      if (remainingMinutes > 0) {
        const breakSession: LegacySessionItem = {
          id: v4(),
          type: sessionNumber % 4 === 0 ? "longBreak" : "shortBreak",
          minutes: sessionNumber % 4 === 0 ? 15 : 5,
          remainingMinutes,
        };
        sessions.push(breakSession);
      }
      sessionNumber++;
    }

    sessions.forEach((session) => {
      session.remainingMinutes = session.minutes;
    });

    // Add a dummy session to mark the end of the task
    sessions.push({
      id: v4(),
      type: "completion",
      minutes: 0,
      remainingMinutes: 0,
    });

    return sessions;
  };

  const startTimer = useCallback(() => {
    // Create the sessions
    // Start the timer
    if (!task) {
      return;
    }
    setSessions(createSessions(task.durationInMinutes));
    setIsRunning(true);
  }, [task]);

  const restartTask = useCallback(() => {
    // Reset the timer
    // Reset the session data
    // Start the timer
    setSessions(createSessions(task.durationInMinutes));
    setCurrentSessionIndex(0);
    setIsRunning(true);
  }, [tasks, currentTaskIndex]);

  const restartSession = useCallback(() => {
    // Reset the current session
    // Start the timer
    setSessions((prev) => {
      const updated = [...prev];
      const currentSession = updated[currentSessionIndex];
      currentSession.remainingMinutes = currentSession.minutes;
      return updated;
    });
    setIsRunning(true);
  }, [currentSessionIndex]);

  const handleSkip = () => {
    // Skip to the next session
    setSessions((prev) => {
      const updated = [...prev];
      const currentSession = updated[currentSessionIndex];
      currentSession.remainingMinutes = 0; // Set remaining minutes to 0, marking it as finished
      currentSession.skipped = true;
      return updated;
    });

    // Move to the next session by triggering completion
    handleSessionComplete?.(sessions);
  };

  const storageService = createStorageService<SessionStorageType>("timerData");

  const storageData = useMemo(() => {
    return {
      tasks,
      sessions,
      currentTaskIndex,
      currentSessionIndex,
    };
  }, [tasks, sessions, currentTaskIndex, currentSessionIndex]);

  useEffect(() => {
    const savedData = storageService.load();
    if (savedData) {
      setTasks(savedData.tasks || []);
      setSessions(savedData.sessions || []);
      setCurrentTaskIndex(savedData.currentTaskIndex || 0);
      setCurrentSessionIndex(savedData.currentSessionIndex || 0);
    }
  }, []);

  useEffect(() => {
    storageService.save(storageData);
  }, [storageData]);

  return (
    <TimerContext.Provider
      value={{
        sessions,
        setSessions,
        currentSessionIndex,
        setCurrentSessionIndex,
        isRunning,
        setIsRunning,
        handleSessionComplete,
        tasks,
        setTasks,
        currentTaskIndex,
        setCurrentTaskIndex,
        restartTask,
        restartSession,
        skipSession: handleSkip,
        startTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimerContext = () => React.useContext(TimerContext);
