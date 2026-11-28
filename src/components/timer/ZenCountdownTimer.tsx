import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Fade } from '@mui/material';
import { PlayArrow, Pause, RestartAlt, Add, Remove, AccessTime } from '@mui/icons-material';
import { useTimer } from 'react-timer-hook';
import dayjs from 'dayjs';
import { CircularTimerRing } from './CircularTimerRing';
import { notificationService } from '@/services/notificationService';
import { persistenceService } from '@/services/persistenceService';
import { useTickSound } from '@/features/timer/hooks/useTickSound';

const TIMER_SNAPSHOT_KEY = 'TIMER_SNAPSHOT';

interface ZenCountdownTimerProps {
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const ZenCountdownTimer: React.FC<ZenCountdownTimerProps> = ({ onRunningStateChange }) => {
  const [isActive, setIsActive] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const activeExpiryRef = useRef<Date | null>(null);

  const handleComplete = () => {
    setIsActive(false);
    activeExpiryRef.current = null;
    persistenceService.clearSnapshot(TIMER_SNAPSHOT_KEY);
    notificationService.showNotification({
      type: 'session_complete',
      title: 'Timer Complete',
      body: 'Your countdown timer has finished!',
      timestamp: new Date(),
    });
  };

  const {
    seconds,
    minutes: timerMinutes,
    hours,
    pause,
    resume,
    restart,
    isRunning,
  } = useTimer({
    expiryTimestamp: new Date(),
    autoStart: false,
    onExpire: handleComplete,
  });

  useTickSound(hours * 3600 + timerMinutes * 60 + seconds, isRunning);

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const formatTime = (h: number, m: number, s: number): string => {
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const calculateProgress = (): number => {
    if (totalSeconds === 0) return 0;
    const remaining = hours * 3600 + timerMinutes * 60 + seconds;
    const elapsed = totalSeconds - remaining;
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };

  const handleStart = () => {
    const totalSecs = minutes * 60;
    setTotalSeconds(totalSecs);
    const expiryTimestamp = dayjs().add(totalSecs, 'second').toDate();
    restart(expiryTimestamp, true);
    activeExpiryRef.current = expiryTimestamp;
    setIsActive(true);
  };

  const handlePause = () => {
    pause();
  };

  const handleResume = () => {
    resume();
  };

  const handleReset = () => {
    const expiryTimestamp = dayjs()
      .add(minutes * 60, 'second')
      .toDate();
    restart(expiryTimestamp, false);
    activeExpiryRef.current = null;
    persistenceService.clearSnapshot(TIMER_SNAPSHOT_KEY);
    setIsActive(false);
    setTotalSeconds(0);
  };

  const handleMinutesChange = (delta: number) => {
    const newValue = Math.max(1, Math.min(480, minutes + delta));
    setMinutes(newValue);
  };

  const isPaused = isActive && !isRunning;

  const getExpectedEndTime = () => {
    if (isActive || isPaused) {
      // When running or paused, show end time based on remaining time
      return dayjs().add(hours, 'hour').add(timerMinutes, 'minute').add(seconds, 'second');
    }
    // When idle, show end time if we start now with the selected duration
    return dayjs().add(minutes, 'minute');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPaused && isActive && setShowControls(false)}
    >
      {/* Status Label */}
      <Typography
        variant="overline"
        sx={{
          color: 'primary.main',
          letterSpacing: '0.2em',
          mb: 4,
          opacity: isActive ? 1 : 0.5,
        }}
      >
        {isRunning ? 'RUNNING' : isActive ? 'PAUSED' : 'TIMER'}
      </Typography>

      {/* Circular Timer */}
      <CircularTimerRing
        progress={calculateProgress()}
        size={300}
        strokeWidth={6}
        isRunning={isRunning}
        isBreak={false}
      >
        {!isActive ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => handleMinutesChange(-1)} size="small">
                <Remove />
              </IconButton>
              <Typography
                sx={{
                  fontSize: '3rem',
                  fontWeight: 200,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                  color: 'text.secondary',
                  minWidth: 100,
                  textAlign: 'center',
                }}
              >
                {minutes}m
              </Typography>
              <IconButton onClick={() => handleMinutesChange(1)} size="small">
                <Add />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime fontSize="small" sx={{ color: 'text.secondary', fontSize: '0.75rem' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Ends at {getExpectedEndTime().format('h:mm A')}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography
              variant="h1"
              className={isRunning ? 'neon-text' : ''}
              sx={{
                fontSize: '4rem',
                fontWeight: 200,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                color: isRunning ? 'primary.main' : 'text.secondary',
                transition: 'all 0.3s ease',
              }}
            >
              {formatTime(hours, timerMinutes, seconds)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <AccessTime fontSize="small" sx={{ color: 'text.secondary', fontSize: '0.875rem' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ends at {getExpectedEndTime().format('h:mm A')}
              </Typography>
            </Box>
          </Box>
        )}
      </CircularTimerRing>

      {/* Controls */}
      <Fade in={showControls || !isActive || isPaused}>
        <Box sx={{ mt: 6, display: 'flex', gap: 2, alignItems: 'center' }}>
          {!isActive && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleStart}
              sx={{ px: 4, py: 1.5 }}
            >
              Start {minutes}m Timer
            </Button>
          )}

          {isPaused && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleResume}
              sx={{ px: 4, py: 1.5 }}
            >
              Resume
            </Button>
          )}

          {isRunning && (
            <IconButton
              onClick={handlePause}
              sx={{
                width: 56,
                height: 56,
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <Pause />
            </IconButton>
          )}

          {isActive && (
            <Tooltip title="Reset">
              <IconButton onClick={handleReset} size="small" sx={{ color: 'error.main' }}>
                <RestartAlt />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Fade>

      {/* Quick Presets */}
      <Fade in={!isActive}>
        <Box sx={{ mt: 4, display: 'flex', gap: 1 }}>
          {[1, 5, 10, 15, 30, 60].map((preset) => (
            <Button
              key={preset}
              variant={minutes === preset ? 'contained' : 'text'}
              size="small"
              onClick={() => setMinutes(preset)}
              sx={{
                minWidth: 48,
                color: minutes === preset ? undefined : 'text.secondary',
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
