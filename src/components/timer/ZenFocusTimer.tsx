import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Fade,
} from "@mui/material";
import {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  History,
  SkipNext,
  CheckCircleOutline,
} from "@mui/icons-material";
import { useTimer } from "react-timer-hook";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CircularTimerRing } from "./CircularTimerRing";
import { AppSettings, CompletionStatus, SessionType, SessionRecord } from "@/features/timer/types";
import { notificationService } from "@/services/notificationService";
import { focusStorage as focusStorageService } from "@/services/focusStorage";
import { persistenceService } from "@/services/persistenceService";

dayjs.extend(duration);

interface SimpleSession {
  type: "focus" | "break";
  duration: number;
  startTime: Date;
  endTime: Date;
}

const generateSessions = (
  totalMinutes: number,
  settings: AppSettings,
  planStartTime: Date = new Date()
): SimpleSession[] => {
  const totalSeconds = totalMinutes * 60;
  const sessions: SimpleSession[] = [];
  let remainingTime = totalSeconds;
  const focusDuration = settings.focusDuration * 60;
  const breakDuration = settings.shortBreakDuration * 60;
  let currentTime = planStartTime.getTime();

  while (remainingTime > 0) {
    if (sessions.length % 2 === 0) {
      const currentFocusDuration = Math.min(focusDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentFocusDuration * 1000);
      sessions.push({ type: "focus", duration: currentFocusDuration, startTime, endTime });
      remainingTime -= currentFocusDuration;
      currentTime = endTime.getTime();
    } else {
      const currentBreakDuration = Math.min(breakDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentBreakDuration * 1000);
      sessions.push({ type: "break", duration: currentBreakDuration, startTime, endTime });
      remainingTime -= currentBreakDuration;
      currentTime = endTime.getTime();
    }
  }
  return sessions;
};

interface ZenFocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  settings: AppSettings;
  onRunningStateChange?: (isRunning: boolean) => void;
  hideTopControls?: boolean;
}

export const ZenFocusTimer: React.FC<ZenFocusTimerProps> = ({
  onOpenSettings,
  onOpenHistory,
  settings,
  onRunningStateChange,
  hideTopControls = false,
}) => {
  const [totalDuration, setTotalDuration] = useState(settings.focusDuration);
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const activeExpiryRef = useRef<Date | null>(null);

  // Refs to hold latest state values for the timer callback
  const sessionsRef = useRef<SimpleSession[]>([]);
  const currentSessionIndexRef = useRef(0);
  const sessionStartTimeRef = useRef<Date | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    currentSessionIndexRef.current = currentSessionIndex;
  }, [currentSessionIndex]);

  useEffect(() => {
    sessionStartTimeRef.current = sessionStartTime;
  }, [sessionStartTime]);

  const recordSession = async (status: CompletionStatus) => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || !sessionStartTime) return;

    const now = new Date();
    const actualDuration = Math.round((now.getTime() - sessionStartTime.getTime()) / 1000);

    const record: SessionRecord = {
      id: `${sessionStartTime.getTime()}-${currentSessionIndex}`,
      type: currentSession.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
      sessionNumber: currentSessionIndex + 1,
      plannedDuration: currentSession.duration,
      actualDuration: actualDuration,
      startTime: sessionStartTime,
      endTime: now,
      completionStatus: status,
      pausedTime: 0,
      remainingTime: 0,
    };

    try {
      await focusStorageService.addSession(record);
    } catch (error) {
      console.error("Failed to save session record:", error);
    }
  };

  const handleExpire = () => {
    // Use refs to get current values
    const currentSessions = sessionsRef.current;
    const currentIndex = currentSessionIndexRef.current;
    const startTime = sessionStartTimeRef.current;

    // Record the completed session
    const currentSession = currentSessions[currentIndex];
    if (currentSession && startTime) {
      const now = new Date();
      const actualDuration = Math.round((now.getTime() - startTime.getTime()) / 1000);

      const record: SessionRecord = {
        id: `${startTime.getTime()}-${currentIndex}`,
        type: currentSession.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
        sessionNumber: currentIndex + 1,
        plannedDuration: currentSession.duration,
        actualDuration: actualDuration,
        startTime: startTime,
        endTime: now,
        completionStatus: CompletionStatus.COMPLETED,
        pausedTime: 0,
        remainingTime: 0,
      };

      focusStorageService.addSession(record).catch((error) => {
        console.error("Failed to save session record:", error);
      });
    }

    // Check if there are more sessions
    if (currentIndex < currentSessions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentSessionIndex(nextIndex);
      setSessionStartTime(new Date()); // Track new session start
      const nextSession = currentSessions[nextIndex];
      const newExpiry = dayjs().add(nextSession.duration, "second").toDate();
      restart(newExpiry, true);
      activeExpiryRef.current = newExpiry;

      notificationService.showNotification({
        type: nextSession.type === "focus" ? "session_start" : "break_complete",
        title: nextSession.type === "focus" ? "Focus Time!" : "Break Time!",
        body: nextSession.type === "focus" ? "Time to focus." : "Take a short break.",
        timestamp: new Date(),
      });
    } else {
      setIsRunning(false);
      setIsComplete(true);
      notificationService.showNotification({
        type: "session_complete",
        title: "Session Complete!",
        body: "Great work! You've completed your focus session.",
        timestamp: new Date(),
      });
      persistenceService.clearSnapshot();
    }
  };

  const resetToIdle = () => {
    setIsComplete(false);
    setIsRunning(false);
    setSessions([]);
    setCurrentSessionIndex(0);
    setSessionStartTime(null);
    setShowControls(false);
  };

  const { seconds, minutes, hours, pause, resume, restart } = useTimer({
    expiryTimestamp: new Date(),
    autoStart: false,
    onExpire: handleExpire,
  });

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const currentSession = sessions[currentSessionIndex];
  const sessionType = currentSession?.type || "focus";
  const isBreak = sessionType === "break";
  const isActive = sessions.length > 0 && isRunning;

  const displayTime = useMemo(() => {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0 && !isRunning) {
      return dayjs.duration(totalDuration, "minutes").format("mm:ss");
    }
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [hours, minutes, seconds, isRunning, totalDuration]);

  const calculateProgress = (): number => {
    if (!currentSession) return 0;
    const totalSeconds = currentSession.duration;
    const elapsed = totalSeconds - (hours * 3600 + minutes * 60 + seconds);
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };

  const startSession = () => {
    const newSessions = generateSessions(totalDuration, settings);
    setSessions(newSessions);
    setCurrentSessionIndex(0);

    const firstSessionDuration = newSessions[0]?.duration || 0;
    const newExpiryTimestamp = dayjs().add(firstSessionDuration, "second").toDate();
    restart(newExpiryTimestamp, true);
    activeExpiryRef.current = newExpiryTimestamp;

    setIsRunning(true);
    setSessionStartTime(new Date());
    setShowControls(true);

    notificationService.showNotification({
      type: "session_start",
      title: "Focus Started",
      body: `${totalDuration} minute focus session begun.`,
      timestamp: new Date(),
    });
  };

  const pauseSession = () => {
    pause();
    setIsRunning(false);
  };

  const resumeSession = () => {
    resume();
    setIsRunning(true);
  };

  const stopSession = () => {
    // Record the interrupted session before stopping
    if (sessions.length > 0 && sessionStartTime) {
      recordSession(CompletionStatus.INTERRUPTED);
    }
    const newExpiryTimestamp = dayjs().add(sessions[0]?.duration || 0, "second").toDate();
    restart(newExpiryTimestamp, false);
    activeExpiryRef.current = newExpiryTimestamp;
    setIsRunning(false);
    setCurrentSessionIndex(0);
    setSessions([]);
    setShowControls(false);
    setSessionStartTime(null);
    persistenceService.clearSnapshot();
  };

  const skipToNext = () => {
    if (currentSessionIndex < sessions.length - 1) {
      // Record current session as skipped
      recordSession(CompletionStatus.SKIPPED);
      const nextIndex = currentSessionIndex + 1;
      setCurrentSessionIndex(nextIndex);
      setSessionStartTime(new Date());
      const nextSession = sessions[nextIndex];
      const newExpiry = dayjs().add(nextSession.duration, "second").toDate();
      restart(newExpiry, true);
      activeExpiryRef.current = newExpiry;

      notificationService.showNotification({
        type: nextSession.type === "focus" ? "session_start" : "break_complete",
        title: nextSession.type === "focus" ? "Focus Time!" : "Break Time!",
        body: nextSession.type === "focus" ? "Time to focus." : "Take a short break.",
        timestamp: new Date(),
      });
    }
  };

  const isPaused = sessions.length > 0 && !isRunning && !isComplete;

  // Show completion screen when all sessions are done
  if (isComplete) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
        }}
      >
        <CheckCircleOutline
          sx={{
            fontSize: 100,
            color: 'success.main',
            mb: 3,
          }}
        />
        <Typography variant="h4" sx={{ fontWeight: 500, mb: 2 }}>
          Session Complete!
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', mb: 4, maxWidth: 300 }}
        >
          Great work! You've successfully completed your focus session.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={resetToIdle}
          sx={{ px: 4, py: 1.5 }}
        >
          Start New Session
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: 4,
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPaused && setShowControls(false)}
    >
      {/* Top Controls - Settings & History (hidden when in dashboard layout) */}
      {!hideTopControls && (
        <Fade in={showControls || !isActive}>
          <Box
            sx={{
              position: "absolute",
              top: 24,
              right: 24,
              display: "flex",
              gap: 1,
            }}
          >
            <Tooltip title="History">
              <IconButton onClick={onOpenHistory} size="small" sx={{ color: "text.secondary" }}>
                <History />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={onOpenSettings} size="small" sx={{ color: "text.secondary" }}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Fade>
      )}

      {/* Session Type Label */}
      <Typography
        variant="overline"
        sx={{
          color: isBreak ? "secondary.main" : "primary.main",
          letterSpacing: "0.2em",
          mb: 4,
          opacity: isActive ? 1 : 0.5,
          transition: "all 0.3s ease",
        }}
      >
        {isActive ? (isBreak ? "BREAK" : "FOCUS") : "READY"}
      </Typography>

      {/* Circular Timer */}
      <CircularTimerRing
        progress={calculateProgress()}
        size={300}
        strokeWidth={6}
        isRunning={isActive}
        isBreak={isBreak}
      >
        <Typography
          variant="h1"
          className={isActive ? (isBreak ? "neon-text-secondary" : "neon-text") : ""}
          sx={{
            fontSize: "4rem",
            fontWeight: 200,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            color: isActive ? (isBreak ? "secondary.main" : "primary.main") : "text.secondary",
            transition: "all 0.3s ease",
          }}
        >
          {displayTime}
        </Typography>
        
        {/* Session indicator */}
        {sessions.length > 1 && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", mt: 1 }}
          >
            {currentSessionIndex + 1} / {sessions.length}
          </Typography>
        )}
      </CircularTimerRing>

      {/* Controls */}
      <Fade in={showControls || !isActive || isPaused}>
        <Box sx={{ mt: 6, display: "flex", gap: 2, alignItems: "center" }}>
          {!isRunning && sessions.length === 0 && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={startSession}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: "1rem",
              }}
            >
              Start {totalDuration}m Focus
            </Button>
          )}

          {isPaused && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={resumeSession}
              sx={{ px: 4, py: 1.5 }}
            >
              Resume
            </Button>
          )}

          {isActive && (
            <>
              <IconButton
                onClick={pauseSession}
                sx={{
                  width: 56,
                  height: 56,
                  border: "1px solid",
                  borderColor: "primary.main",
                }}
              >
                <Pause />
              </IconButton>

              <Tooltip title="Skip to next">
                <IconButton
                  onClick={skipToNext}
                  size="small"
                  sx={{ color: "text.secondary" }}
                >
                  <SkipNext />
                </IconButton>
              </Tooltip>
            </>
          )}

          {(isActive || isPaused) && (
            <Tooltip title="Stop session">
              <IconButton
                onClick={stopSession}
                size="small"
                sx={{ color: "error.main" }}
              >
                <Stop />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Fade>

      {/* Duration Quick Select (only when not active) */}
      <Fade in={!isActive && !isPaused}>
        <Box sx={{ mt: 4, display: "flex", gap: 1 }}>
          {(settings.quickPresets || [15, 25, 30, 45, 60]).map((preset) => (
            <Button
              key={preset}
              variant={totalDuration === preset ? "contained" : "text"}
              size="small"
              onClick={() => setTotalDuration(preset)}
              sx={{
                minWidth: 48,
                color: totalDuration === preset ? undefined : "text.secondary",
              }}
            >
              {preset}m
            </Button>
          ))}
        </Box>
      </Fade>
    </Box>
  );
};
