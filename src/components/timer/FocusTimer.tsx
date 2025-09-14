import React, { useState, useEffect, useMemo } from "react";
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

dayjs.extend(duration);

interface SimpleSession {
  type: "focus" | "break";
  duration: number; // in seconds
}

// The component now uses settings for session durations.
const generateSessions = (
  totalMinutes: number,
  settings: AppSettings
): SimpleSession[] => {
  const totalSeconds = totalMinutes * 60;
  const sessions: SimpleSession[] = [];
  let remainingTime = totalSeconds;
  const focusDuration = settings.focusDuration * 60;
  const breakDuration = settings.shortBreakDuration * 60;

  while (remainingTime > 0) {
    if (sessions.length % 2 === 0) {
      // Focus session
      const currentFocusDuration = Math.min(focusDuration, remainingTime);
      sessions.push({ type: "focus", duration: currentFocusDuration });
      remainingTime -= currentFocusDuration;
    } else {
      // Break session
      const currentBreakDuration = Math.min(breakDuration, remainingTime);
      sessions.push({ type: "break", duration: currentBreakDuration });
      remainingTime -= currentBreakDuration;
    }
  }
  return sessions;
};interface FocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
  settings: AppSettings;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenFeedback,
  settings,
}) => {
  // Defensive check to prevent rendering with undefined settings
  if (!settings) {
    return <Box>Loading...</Box>;
  }
  // Simple state management following SessionTimer approach
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalDuration, setTotalDuration] = useState(25);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

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
      plannedDuration: currentSession.duration / 60,
      actualDuration: actualDuration / 60,
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
    const newSessions = generateSessions(totalDuration, settings);
    setSessions(newSessions);
    if (!isRunning) {
      const newExpiryTimestamp = dayjs()
        .add(newSessions[0]?.duration || 0, "second")
        .toDate();
      restart(newExpiryTimestamp, false);
    }
  }, [totalDuration, settings]);

  // Effect to restart timer when session changes
  useEffect(() => {
    if (sessions.length > 0) {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession) {
        const newExpiryTimestamp = dayjs()
          .add(currentSession.duration, "second")
          .toDate();
        restart(newExpiryTimestamp, isRunning); // `isRunning` will be false for the initial load, and true for subsequent auto-started sessions
      }
    }
  }, [currentSessionIndex]);

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

  // This function is now the single source of truth for duration changes.
  // It is already defined above, so we remove this duplicate.
  /*
  const handleTotalDurationChange = (value: number) => {
    const clampedValue = Math.max(1, Math.min(480, value));
    setTotalDuration(clampedValue);
  };
  */

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
    setIsRunning(false);
    setCurrentSessionIndex(0);
  };

  // Remove complex pause/resume logic - SessionTimer approach
  const fastForwardSession = (secondsToSkip: number) => {
    const remainingSeconds = hours * 3600 + minutes * 60 + seconds;
    const newRemaining = Math.max(0, remainingSeconds - secondsToSkip);
    const newExpiry = dayjs().add(newRemaining, "second").toDate();
    restart(newExpiry, true);
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
        {sessions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, color: "text.secondary" }}
            >
              Session {currentSessionIndex + 1} of {sessions.length}
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                justifyContent: "center",
                flexWrap: "wrap",
                mb: 2,
              }}
            >
              {sessions.map((session, index) => {
                const isCompleted = index < currentSessionIndex;
                const isActive = index === currentSessionIndex;
                const isFuture = index > currentSessionIndex;

                return (
                  <Tooltip
                    key={index}
                    title={`${
                      session.type === "focus" ? "Focus" : "Break"
                    } - ${Math.floor(session.duration / 60)}min`}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isCompleted
                          ? "success.light"
                          : isActive
                          ? "primary.main"
                          : "grey.200",
                        border: "none",
                        borderColor: "primary.dark",
                        transition: "all 0.2s ease-in-out",
                        transform: isActive ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      {session.type === "focus" ? (
                        <Work
                          sx={{
                            fontSize: 16,
                            color: isFuture ? "grey.600" : "white",
                          }}
                        />
                      ) : (
                        <Coffee
                          sx={{
                            fontSize: 16,
                            color: isFuture ? "grey.600" : "white",
                          }}
                        />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>

            {/* Next Session Preview */}
            {sessions.length > currentSessionIndex + 1 && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Next:{" "}
                {sessions[currentSessionIndex + 1].type === "focus"
                  ? "Focus Session"
                  : "Break"}
              </Typography>
            )}
          </Box>
        )}
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
        onStartNewSession={() => {
          setIsComplete(false);
        }}
      />
    );
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
      <Box
        sx={{ textAlign: "center", mb: 4, width: "100%", px: { xs: 0, sm: 2 } }}
      >
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
          spacing={1}
          justifyContent="center"
          flexWrap="wrap"
        >
          {(settings.quickPresets || [15, 25, 45, 90]).map((duration) => (
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
      </Box>
      {renderTimerDisplay()}
      {renderControls()}
      {renderActionButtons()}
    </Paper>
  );
};
