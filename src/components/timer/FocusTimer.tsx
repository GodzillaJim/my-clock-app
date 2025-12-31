import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  Timer as TimerIcon,
  Feedback,
  History,
  FastForward,
  Coffee,
  Work,
  Add,
  Remove,
} from "@mui/icons-material";
import { useTimer } from "react-timer-hook";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CompletionScreen } from "./CompletionScreen";
import { AppSettings, SessionRecord, CompletionStatus, SessionType } from "@/features/timer/types";
import { notificationService } from "@/services/notificationService";
import { focusStorage as focusStorageService } from "@/services/focusStorage";
import { persistenceService } from "@/services/persistenceService";
import { SessionPlan } from './SessionPlan';

dayjs.extend(duration);

interface SimpleSession {
  type: "focus" | "break";
  duration: number; // in seconds
  startTime: Date;
  endTime: Date;
}

// The component now uses settings for session durations.
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
      // Focus session
      const currentFocusDuration = Math.min(focusDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentFocusDuration * 1000);
      sessions.push({ type: "focus", duration: currentFocusDuration, startTime, endTime });
      remainingTime -= currentFocusDuration;
      currentTime = endTime.getTime();
    } else {
      // Break session
      const currentBreakDuration = Math.min(breakDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentBreakDuration * 1000);
      sessions.push({ type: "break", duration: currentBreakDuration, startTime, endTime });
      remainingTime -= currentBreakDuration;
      currentTime = endTime.getTime();
    }
  }
  return sessions;
};interface FocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
  settings: AppSettings;
  hideActionButtons?: boolean;
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenFeedback,
  settings,
  hideActionButtons = false,
  onRunningStateChange,
}) => {
  // Defensive check to prevent rendering with undefined settings
  if (!settings) {
    return <Box>Loading...</Box>;
  }

  // Debug logging to track settings changes
  useEffect(() => {
    console.log('FocusTimer: Received settings update:', settings);
    console.log('FocusTimer: quickPresets:', settings.quickPresets);
  }, [settings]);

  // Simple state management following SessionTimer approach
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalDuration, setTotalDuration] = useState(25);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  // Persistence state
  const activeExpiryRef = useRef<Date | null>(null);
  const [restoredExpiry, setRestoredExpiry] = useState<Date | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleTotalDurationChange = (value: number | string) => {
    const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(numericValue)) {
      return; // Or handle as an error, but for now, just ignore invalid input
    }
    const clampedValue = Math.max(1, Math.min(480, numericValue));
    setTotalDuration(clampedValue);
  };

  const incrementDuration = () => {
    handleTotalDurationChange(totalDuration + 5);
  };

  const decrementDuration = () => {
    handleTotalDurationChange(totalDuration - 5);
  };

  const recordSession = async (status: CompletionStatus) => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || !sessionStartTime) return;

    const now = new Date();
    const actualDuration = (now.getTime() - sessionStartTime.getTime()) / 1000; // in seconds

    const record: SessionRecord = {
      id: `${sessionStartTime.getTime()}-${currentSessionIndex}`,
      type: currentSession.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
      sessionNumber: currentSessionIndex + 1,
      plannedDuration: currentSession.duration,
      actualDuration: actualDuration,
      startTime: sessionStartTime,
      endTime: now,
      completionStatus: status,
      pausedTime: 0, // This would require more complex tracking
      remainingTime: 0,
    };

    try {
      await focusStorageService.addSession(record);
    } catch (error) {
      console.error("Failed to save session record:", error);
    }
  };

  const handleSessionComplete = () => {
    recordSession(CompletionStatus.COMPLETED);
    const currentSession = sessions[currentSessionIndex];
    if (currentSession) {
      notificationService.showNotification({
        type:
          currentSession.type === "focus"
            ? "session_complete"
            : "break_complete",
        title:
          currentSession.type === "focus" ? "Focus Complete" : "Break Over",
        body:
          currentSession.type === "focus"
            ? "Time for a break!"
            : "Back to focus!",
        timestamp: new Date(),
      });
    }

    if (currentSessionIndex < sessions.length - 1) {
      // Move to next session
      setCurrentSessionIndex((prev) => prev + 1);
    } else {
      // All sessions complete
      setIsRunning(false);
      setIsComplete(true);
      notificationService.showNotification({
        type: 'session_complete',
        title: 'All Sessions Complete!',
        body: 'Great job! You have completed all your sessions.',
        timestamp: new Date(),
      });
    }
  };

  const { seconds, minutes, hours, pause, resume, restart } = useTimer({
    expiryTimestamp: new Date(),
    autoStart: false,
    onExpire: handleSessionComplete,
  });

  // Initialize and update sessions
  useEffect(() => {
    // If restoring, skip initial generation (or handle it carefully)
    if (isRestoring || sessions.length > 0) return;

    const newSessions = generateSessions(totalDuration, settings);
    setSessions(newSessions);
    if (!isRunning) {
      const newExpiryTimestamp = dayjs()
        .add(newSessions[0]?.duration || 0, "second")
        .toDate();
      restart(newExpiryTimestamp, false);
      activeExpiryRef.current = newExpiryTimestamp;
    }
  }, [totalDuration, settings, isRestoring]);

  // Effect to restart timer when session changes
  useEffect(() => {
    if (sessions.length > 0) {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession) {
        if (restoredExpiry) {
           // Resume from restoration point
           console.log('Restoring session with expiry:', restoredExpiry);
           restart(restoredExpiry, true); // Auto-resume if restoring active session
           activeExpiryRef.current = restoredExpiry;
           setRestoredExpiry(null);
           setSessionStartTime(new Date()); // Approximate start time for current session
           setIsRunning(true);
        } else {
           // Normal session transition
           const newExpiryTimestamp = dayjs()
             .add(currentSession.duration, "second")
             .toDate();
           restart(newExpiryTimestamp, isRunning); 
           activeExpiryRef.current = newExpiryTimestamp;
           if (isRunning) {
             setSessionStartTime(new Date());
           }
        }
      }
    }
  }, [currentSessionIndex, restoredExpiry]);

  // Notify parent when running state changes
  useEffect(() => {
    onRunningStateChange?.(isRunning);
    
    // Auto-save logic
    if (isRunning && activeExpiryRef.current) {
        // Save snapshot
        const snapshot = {
            id: 'current',
            type: sessions[currentSessionIndex]?.type === 'focus' ? 'FOCUS' : 'SHORT_BREAK',
            startTime: sessionStartTime?.getTime() || Date.now(),
            targetDuration: sessions[currentSessionIndex]?.duration || 0,
            elapsedAtLastSnapshot: 0, // Not strictly used with expiry calculation but good for metadata
            lastUpdated: Date.now(),
            status: 'RUNNING',
            expiryTimestamp: activeExpiryRef.current.getTime(),
            currentSessionIndex,
            totalDurationSettings: totalDuration,
            sessions: sessions // We might want to persist the plan too? For now, regenerate or persist.
            // Simplified: we rely on totalDuration to regenerate sessions. 
            // Better: persist the sessions array if it's dynamic. 
            // For now, let's assume regeneration from totalDuration is fine IF we persist totalDuration.
        } as any; 
        
        // Extended snapshot for our specific needs (merging with defined type or extending it)
        persistenceService.saveSnapshot({
            ...snapshot,
            sessions, // Save the actual sessions plan
        });
    } else if (!isRunning && sessions.length > 0) {
       // Also save when paused?
       // If paused, expiry time is not moving ??? 
       // react-timer-hook pause() freezes the timer.
       // On resume, it recalculates expiry? 
       // Actually react-timer-hook `pause` works by stopping the interval. 
       // `resume` sets a NEW expiry based on remaining time.
       // So if PAUSED, we must save REMAINING time, not expiry.
    }
  }, [isRunning, onRunningStateChange, seconds]); // Trigger on seconds change (every second)

  // Restore logic on mount
  useEffect(() => {
    const snapshot = persistenceService.loadSnapshot() as any;
    if (snapshot && snapshot.status === 'RUNNING') {
        // Check if we should resume based on settings
        const strategy = settings.resumeStrategy || 'elapsed';
        const now = Date.now();
        const savedExpiry = snapshot.expiryTimestamp;
        
        console.log('Found snapshot:', snapshot);
        setIsRestoring(true);
        setTotalDuration(snapshot.totalDurationSettings);
        setSessions(snapshot.sessions); // Restore exact plan
        setCurrentSessionIndex(snapshot.currentSessionIndex);
        
        let newExpiry = new Date(savedExpiry);
        
        if (strategy === 'pause') {
            // Treat downtime as pause
            // Effectively, we "paused" at lastUpdated. 
            // So we shift the expiry by (now - lastUpdated)
            const downtime = now - snapshot.lastUpdated;
            newExpiry = new Date(savedExpiry + downtime);
        }
        
        // If elapsed strategy, newExpiry is just savedExpiry (absolute time target)
        
        // Check if expired
        if (newExpiry.getTime() <= now) {
            // Session finished while away
            // Currently just reset or show complete?
            // Let's reset for now or handle completion.
            console.log('Session expired while away');
            persistenceService.clearSnapshot();
            setIsRestoring(false);
            setSessions([]); 
        } else {
            console.log('Resuming session with strategy:', strategy);
            setRestoredExpiry(newExpiry);
            // setIsRestoring(false) will happen after effect? 
            // No, we need to keep isRestoring true until the effect processes it?
            // Actually, setting state triggers re-render.
            // setRestoredExpiry -> triggers effect [restoredExpiry] -> calls restart -> clears restoredExpiry.
        }
    }
  }, []); // Run once on mount

  // Simple helper functions following SessionTimer approach
  const formatTime = (h: number, m: number, s: number): string => {
    const totalSeconds = h * 3600 + m * 60 + s;
    if (totalSeconds <= 0 && !isRunning) {
      return dayjs.duration(totalDuration, "minutes").format("mm:ss");
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const calculateProgress = (): number => {
    if (!sessions[currentSessionIndex]) return 0;
    const totalSeconds = sessions[currentSessionIndex].duration;
    const elapsed = totalSeconds - (hours * 3600 + minutes * 60 + seconds);
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };


  // Simple start/stop functions following SessionTimer approach
  const startSession = () => {
    const newSessions = generateSessions(totalDuration, settings);
    setSessions(newSessions);
    setCurrentSessionIndex(0);

    const firstSessionDuration = newSessions[0]?.duration || 0;
    const newExpiryTimestamp = dayjs()
      .add(firstSessionDuration, "second")
      .toDate();
    restart(newExpiryTimestamp, true);
    activeExpiryRef.current = newExpiryTimestamp;

    setIsRunning(true);
    setIsComplete(false);
    setSessionStartTime(new Date());

    notificationService.showNotification({
      type: 'session_start',
      title: 'Session Started',
      body: `Your ${totalDuration}-minute focus session has begun.`,
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
    recordSession(CompletionStatus.INTERRUPTED);
    const newExpiryTimestamp = dayjs()
      .add(sessions[0]?.duration || 0, "second")
      .toDate();
    restart(newExpiryTimestamp, false);
    activeExpiryRef.current = newExpiryTimestamp;
    setIsRunning(false);
    setCurrentSessionIndex(0);
    persistenceService.clearSnapshot();
  };

  // Reset everything to initial idle state (used after completion when user starts fresh)
  const resetToIdle = () => {
    // Stop any running timer
    pause();
    setIsRunning(false);
    setIsComplete(false);
    setSessions([]); // remove old plan so input + presets show again
    setCurrentSessionIndex(0);
    setSessionStartTime(null);
  };

  // Remove complex pause/resume logic - SessionTimer approach
  const fastForwardSession = (secondsToSkip: number) => {
    const remainingSeconds = hours * 3600 + minutes * 60 + seconds;
    const newRemaining = Math.max(0, remainingSeconds - secondsToSkip);
    const newExpiry = dayjs().add(newRemaining, "second").toDate();
    restart(newExpiry, true);
    activeExpiryRef.current = newExpiry;
  };

  const skipSession = () => {
    recordSession(CompletionStatus.SKIPPED);
    handleSessionComplete();
  };

  const isPaused = !isRunning && calculateProgress() > 0;

  const renderTimerDisplay = () => {
    // Simple display logic following SessionTimer approach
    const currentSession = sessions[currentSessionIndex];
    const displayTime = formatTime(hours, minutes, seconds);
    const sessionType = currentSession?.type || "focus";
    const isActive = isRunning;

    const getExpectedEndTime = () => {
      if (isActive || isPaused) {
        // When running or paused, show end time for the current session
        return dayjs().add(hours, 'hour').add(minutes, 'minute').add(seconds, 'second');
      }
      // When idle, show end time for the entire plan
      const totalPlanSeconds = sessions.reduce((total, session) => total + session.duration, 0);
      return dayjs().add(totalPlanSeconds, 'second');
    };

    return (
      <Box sx={{ textAlign: "center", width: "100%" }}>
        {/* Session Type Indicator */}
        {isActive ? (
          <Chip
            label={sessionType === "focus" ? "Focus Session" : "Break"}
            color={sessionType === "focus" ? "primary" : "secondary"}
            size="small"
            sx={{ mb: 3 }}
          />
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 3,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            Ready to Focus
          </Typography>
        )}

        {/* Clean Timer Display */}
        <Typography
          variant="h1"
          component="div"
          sx={{
            fontSize: { xs: "4rem", sm: "5rem", md: "6rem" },
            fontWeight: 300,
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            lineHeight: 1,
            mb: 2,
            color: isActive ? "primary.main" : "text.secondary",
            transition: "color 0.3s ease",
            fontVariantNumeric: "tabular-nums",
            WebkitFontFeatureSettings: '"tnum"',
            fontFeatureSettings: '"tnum"',
          }}
        >
          {displayTime}
        </Typography>

        {/* Expected End Time */}
        {(isActive || isPaused || sessions.length > 0) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary', mb: 3 }}>
            <TimerIcon fontSize="small" />
            <Typography
              variant="body1"
            >
              {getExpectedEndTime().format('h:mm A')}
            </Typography>
          </Box>
        )}

        {/* Session Status */}
        {isActive && (
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "block",
              mb: 3,
            }}
          >
            {Math.round(calculateProgress())}% complete
          </Typography>
        )}

        {isActive && (
          <Box sx={{ width: "100%", mb: 4 }}>
            <LinearProgress
              variant="determinate"
              value={calculateProgress()}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: "divider",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 2,
                  backgroundColor: "primary.main",
                },
              }}
            />
          </Box>
        )}

        {/* Session Plan Visualization */}
        <SessionPlan sessions={sessions} currentSessionIndex={currentSessionIndex} />
      </Box>
    );
  };

  const renderControls = () => (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      justifyContent="center"
      alignItems="center"
      sx={{ width: "100%" }}
    >
      {!isRunning && !isPaused && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={startSession}
          sx={{
            minWidth: { xs: "100%", sm: 200 },
            py: 1.5,
          }}
        >
          Start {totalDuration}min Focus
        </Button>
      )}

      {isPaused && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={resumeSession}
          sx={{
            minWidth: { xs: "100%", sm: 200 },
            py: 1.5,
          }}
        >
          Resume
        </Button>
      )}

      {isRunning && (
        <>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Pause />}
            onClick={pauseSession}
            sx={{ minWidth: { xs: "100%", sm: "auto" } }}
          >
            Pause
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Stop />}
            onClick={stopSession}
            color="error"
            sx={{ minWidth: { xs: "100%", sm: "auto" } }}
          >
            Stop
          </Button>
          <Button
            variant="text"
            size="large"
            onClick={skipSession}
            sx={{
              minWidth: { xs: "100%", sm: "auto" },
              color: "text.secondary",
            }}
          >
            Skip
          </Button>
        </>
      )}

      {isPaused && (
        <Button
          variant="outlined"
          size="large"
          startIcon={<Stop />}
          onClick={stopSession}
          color="error"
          sx={{ minWidth: { xs: "100%", sm: 160 } }}
        >
          Stop
        </Button>
      )}

      {isRunning && (
        <Tooltip title="Fast Forward 60s (for testing)">
          <IconButton onClick={() => fastForwardSession(60)} color="secondary">
            <FastForward />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  const renderActionButtons = () => (
    <Stack direction="row" spacing={1} justifyContent="center">
      <Tooltip title="Settings">
        <IconButton onClick={onOpenSettings} size="small">
          <Settings fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Session History">
        <IconButton onClick={onOpenHistory} size="small">
          <History fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Submit Feedback">
        <IconButton onClick={onOpenFeedback} size="small">
          <Feedback fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (isComplete) {
    return (
      <CompletionScreen
        onStartNewSession={resetToIdle}
      />
    );
  }

  // Render content without Paper wrapper when used in ToolSwitcher
  const content = (
    <>
      <Box
        sx={{ textAlign: "center", mb: 4, width: "100%", px: { xs: 0, sm: 2 } }}
      >
        {/* Show duration controls only when timer is not running or paused */}
        {!isRunning && !isPaused && (
          <>
            {/* Custom Duration Input */}
            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <IconButton onClick={decrementDuration} size="small">
                <Remove />
              </IconButton>
              <TextField
                variant="standard"
                value={totalDuration}
                onChange={(e) => handleTotalDurationChange(e.target.value)}
                size="small"
                sx={{
                  width: "100px",
                  "& .MuiInputBase-input": {
                    textAlign: "center",
                    fontWeight: "bold",
                  },
                }}
                InputProps={{
                  disableUnderline: true,
                  endAdornment: <InputAdornment position="end">min</InputAdornment>,
                }}
              />
              <IconButton onClick={incrementDuration} size="small">
                <Add />
              </IconButton>
            </Stack>

            {/* Quick presets */}
            <Stack
              direction="row"
              justifyContent="center"
              flexWrap="wrap"
              gap={1}
            >
              {(settings.quickPresets || [15, 25, 30, 45, 60]).map((duration) => (
                <Chip
                  key={duration}
                  label={`${duration}m`}
                  variant={totalDuration === duration ? "filled" : "outlined"}
                  color={totalDuration === duration ? "primary" : "default"}
                  onClick={() => handleTotalDurationChange(duration)}
                  size="small"
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Stack>
          </>
        )}
      </Box>
      {renderTimerDisplay()}
      {renderControls()}
      {!hideActionButtons && renderActionButtons()}
    </>
  );

  // If hideActionButtons is true, return content without Paper wrapper
  if (hideActionButtons) {
    return content;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 2, sm: 4 },
        borderRadius: 4,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {content}
    </Paper>
  );
};
