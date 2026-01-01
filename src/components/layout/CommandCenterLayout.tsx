import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  History,
  SkipNext,
} from '@mui/icons-material';
import { CircularTimerRing } from '../timer/CircularTimerRing';
import { AppSettings } from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { useTimer } from 'react-timer-hook';
import dayjs from 'dayjs';

interface SimpleSession {
  type: 'focus' | 'break';
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
      sessions.push({ type: 'focus', duration: currentFocusDuration, startTime, endTime });
      remainingTime -= currentFocusDuration;
      currentTime = endTime.getTime();
    } else {
      const currentBreakDuration = Math.min(breakDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentBreakDuration * 1000);
      sessions.push({ type: 'break', duration: currentBreakDuration, startTime, endTime });
      remainingTime -= currentBreakDuration;
      currentTime = endTime.getTime();
    }
  }
  return sessions;
};

interface CommandCenterLayoutProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const CommandCenterLayout: React.FC<CommandCenterLayoutProps> = ({
  settings,
  onOpenSettings,
  onOpenHistory,
}) => {
  const [totalDuration, setTotalDuration] = useState(settings.focusDuration);
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({ focusTime: 0, completed: 0 });

  const handleExpire = () => {
    if (currentSessionIndex < sessions.length - 1) {
      const nextIndex = currentSessionIndex + 1;
      setCurrentSessionIndex(nextIndex);
      const nextSession = sessions[nextIndex];
      const newExpiry = dayjs().add(nextSession.duration, 'second').toDate();
      restart(newExpiry, true);
    } else {
      setIsRunning(false);
      setSessions([]);
      loadStats();
    }
  };

  const { seconds, minutes, hours, pause, resume, restart } = useTimer({
    expiryTimestamp: new Date(),
    autoStart: false,
    onExpire: handleExpire,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const history = await focusStorage.getTodayHistory();
      if (history) {
        setTodayStats({
          focusTime: Math.round(history.totalFocusTime / 60),
          completed: history.completedSessions || 0,
        });
        // Get recent sessions
        setRecentSessions(history.sessions?.slice(-5).reverse() || []);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const currentSession = sessions[currentSessionIndex];
  const sessionType = currentSession?.type || 'focus';
  const isBreak = sessionType === 'break';
  const isActive = sessions.length > 0;

  const calculateProgress = (): number => {
    if (!currentSession) return 0;
    const totalSeconds = currentSession.duration;
    const elapsed = totalSeconds - (hours * 3600 + minutes * 60 + seconds);
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };

  const displayTime = () => {
    if (!isActive) {
      return dayjs.duration(totalDuration, 'minutes').format('mm:ss');
    }
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const startSession = () => {
    const newSessions = generateSessions(totalDuration, settings);
    setSessions(newSessions);
    setCurrentSessionIndex(0);
    const firstSessionDuration = newSessions[0]?.duration || 0;
    const newExpiryTimestamp = dayjs().add(firstSessionDuration, 'second').toDate();
    restart(newExpiryTimestamp, true);
    setIsRunning(true);
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
    setIsRunning(false);
    setSessions([]);
    setCurrentSessionIndex(0);
  };

  const isPaused = isActive && !isRunning;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Command Center
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="History">
            <IconButton onClick={onOpenHistory} size="small">
              <History />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={onOpenSettings} size="small">
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Timer Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <CircularTimerRing
          progress={calculateProgress()}
          size={200}
          strokeWidth={6}
          isRunning={isRunning}
          isBreak={isBreak}
        >
          <Typography
            className={isRunning ? (isBreak ? 'neon-text-secondary' : 'neon-text') : ''}
            sx={{
              fontSize: '2.5rem',
              fontWeight: 200,
              fontFamily: 'ui-monospace, monospace',
              color: isActive ? (isBreak ? 'secondary.main' : 'primary.main') : 'text.secondary',
            }}
          >
            {displayTime()}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {isActive ? (isBreak ? 'BREAK' : 'FOCUS') : 'READY'}
          </Typography>
        </CircularTimerRing>
      </Box>

      {/* Session Timeline */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'rgba(24, 24, 28, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Session Plan
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
          {sessions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Start a session to see your plan
            </Typography>
          ) : (
            sessions.map((session, index) => (
              <Chip
                key={index}
                label={`${Math.round(session.duration / 60)}m ${session.type}`}
                size="small"
                color={session.type === 'focus' ? 'primary' : 'secondary'}
                variant={index === currentSessionIndex ? 'filled' : 'outlined'}
                sx={{
                  opacity: index < currentSessionIndex ? 0.5 : 1,
                }}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Two Column Section */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
        {/* Recent Sessions */}
        <Paper
          sx={{
            flex: 1,
            p: 2,
            backgroundColor: 'rgba(24, 24, 28, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1 }}>
            Recent Sessions
          </Typography>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {recentSessions.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No sessions yet today
              </Typography>
            ) : (
              recentSessions.map((session, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                    borderBottom: index < recentSessions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: session.type === 'focus' ? 'primary.main' : 'secondary.main',
                      }}
                    />
                    <Typography variant="body2">{session.type === 'focus' ? 'Focus' : 'Break'}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {Math.round(session.plannedDuration / 60)}m
                  </Typography>
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Stats */}
        <Paper
          sx={{
            flex: 1,
            p: 2,
            backgroundColor: 'rgba(24, 24, 28, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Typography variant="overline" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
            Today's Stats
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 600 }}>
                {Math.floor(todayStats.focusTime / 60)}h {todayStats.focusTime % 60}m
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total Focus Time
              </Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
            <Box>
              <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 600 }}>
                {todayStats.completed}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Completed Sessions
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Bottom Control Bar */}
      <Paper
        sx={{
          mt: 3,
          p: 2,
          backgroundColor: 'rgba(18, 18, 22, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Duration Presets */}
        {!isActive && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(settings.quickPresets || [15, 25, 30, 45, 60]).map((preset) => (
              <Button
                key={preset}
                variant={totalDuration === preset ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setTotalDuration(preset)}
                sx={{ minWidth: 48 }}
              >
                {preset}m
              </Button>
            ))}
          </Box>
        )}

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', mx: 2 }} />

        {/* Main Controls */}
        {!isActive && (
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrow />}
            onClick={startSession}
            sx={{ px: 4 }}
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
          >
            Resume
          </Button>
        )}

        {isRunning && (
          <>
            <IconButton
              onClick={pauseSession}
              sx={{
                width: 48,
                height: 48,
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <Pause />
            </IconButton>
            <Tooltip title="Skip">
              <IconButton onClick={handleExpire} size="small">
                <SkipNext />
              </IconButton>
            </Tooltip>
          </>
        )}

        {isActive && (
          <Tooltip title="Stop">
            <IconButton onClick={stopSession} size="small" sx={{ color: 'error.main' }}>
              <Stop />
            </IconButton>
          </Tooltip>
        )}
      </Paper>
    </Box>
  );
};
