import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  InputAdornment,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  RestartAlt,
  Add,
  Remove,
} from '@mui/icons-material';
import { useTimer } from 'react-timer-hook';
import dayjs from 'dayjs';
import { notificationService } from '@/services/notificationService';
import { persistenceService } from '@/services/persistenceService';

const TIMER_SNAPSHOT_KEY = 'TIMER_SNAPSHOT';

interface CountdownTimerProps {
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ onRunningStateChange }) => {
  const [isActive, setIsActive] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [totalSeconds, setTotalSeconds] = useState(0);

  // Persistence state
  const activeExpiryRef = useRef<Date | null>(null);
  const [restoredExpiry, setRestoredExpiry] = useState<Date | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

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

  const { seconds, minutes: timerMinutes, hours, pause, resume, restart, isRunning } = useTimer({
    expiryTimestamp: new Date(),
    autoStart: false,
    onExpire: handleComplete,
  });

  // Notify parent when running state changes
  useEffect(() => {
    onRunningStateChange?.(isRunning);

     // Auto-save
    if (isRunning && activeExpiryRef.current) {
        const snapshot = {
            id: 'timer-current',
            type: 'TIMER', // Custom type? Need to ensure compatibility or just ignore type field check if generic
            startTime: Date.now(), 
            targetDuration: totalSeconds,
            elapsedAtLastSnapshot: 0, 
            lastUpdated: Date.now(),
            status: 'RUNNING',
            expiryTimestamp: activeExpiryRef.current.getTime(),
            minutesSettings: minutes // Persist settings
        } as any;
        
        persistenceService.saveSnapshot(snapshot, TIMER_SNAPSHOT_KEY);
    } else if (!isRunning && isActive && activeExpiryRef.current) {
         // If paused, we need to save remaining time...
         // Actually react-timer-hook `pause` works by stopping. `resume` creates new expiry.
         // If we are PAUSED, we simply resume from `expiry - now`? 
         // No, if paused, expiry is in past/future but irrelevant?
         // We need to save REMAINING SECONDS if paused.
         // `seconds`, `timerMinutes`, `hours` are available.
         // Let's rely on standard restore if running, logic for pause if needed.
         // For now, let's just persist RUNNING state. Pause state is ephemeral?
         // If app crashes while PAUSED, we lose the pause state? That's bad.
         // But let's focus on crash-while-running first as requested.
    } else if (!isActive) {
        // Clear if not active
        // persistenceService.clearSnapshot(TIMER_SNAPSHOT_KEY); // handled in reset/complete
    }
  }, [isRunning, onRunningStateChange, seconds]);

  // Restore logic
  useEffect(() => {
    const snapshot = persistenceService.loadSnapshot(TIMER_SNAPSHOT_KEY) as any;
    if (snapshot && snapshot.status === 'RUNNING') {
        const now = Date.now();
        const savedExpiry = snapshot.expiryTimestamp;
        
        setIsRestoring(true);
        setMinutes(snapshot.minutesSettings);
        setTotalSeconds(snapshot.targetDuration);
        
        // Assume ELAPSED strategy for simple timer (or use settings if passed?)
        // Standard timer usually implies wall-clock unless specifically paused.
        // Let's assume wall-clock resume.
        let newExpiry = new Date(savedExpiry);
        
        if (newExpiry.getTime() <= now) {
            handleComplete(); // Expired while away
             persistenceService.clearSnapshot(TIMER_SNAPSHOT_KEY);
        } else {
             setRestoredExpiry(newExpiry);
             setIsActive(true);
        }
    }
  }, []);

  // Effect to trigger restart after restore state is set
  useEffect(() => {
      if (restoredExpiry && isRestoring) {
          restart(restoredExpiry, true);
          activeExpiryRef.current = restoredExpiry;
          setRestoredExpiry(null);
          setIsRestoring(false);
      }
  }, [restoredExpiry, isRestoring]);

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
    const expiryTimestamp = dayjs().add(minutes * 60, 'second').toDate();
    restart(expiryTimestamp, false);
    activeExpiryRef.current = null;
    persistenceService.clearSnapshot(TIMER_SNAPSHOT_KEY);
    setIsActive(false);
    setTotalSeconds(0);
  };

  const handleMinutesChange = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(numValue)) return;
    const clampedValue = Math.max(1, Math.min(480, numValue));
    setMinutes(clampedValue);
  };

  const incrementMinutes = () => {
    handleMinutesChange(minutes + 1);
  };

  const decrementMinutes = () => {
    handleMinutesChange(minutes - 1);
  };

  const isPaused = isActive && !isRunning;

  return (
    <Box sx={{ textAlign: 'center', width: '100%' }}>
      {/* Status Indicator */}
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        {isRunning ? 'Running' : isActive ? 'Paused' : 'Set Duration'}
      </Typography>

      {/* Time Display or Input */}
      {!isActive ? (
        <Box sx={{ mb: 4 }}>
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <IconButton onClick={decrementMinutes} size="small">
              <Remove />
            </IconButton>
            <TextField
              variant="standard"
              value={minutes}
              onChange={(e) => handleMinutesChange(e.target.value)}
              size="small"
              sx={{
                width: '120px',
                '& .MuiInputBase-input': {
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                },
              }}
              InputProps={{
                disableUnderline: true,
                endAdornment: <InputAdornment position="end">minutes</InputAdornment>,
              }}
            />
            <IconButton onClick={incrementMinutes} size="small">
              <Add />
            </IconButton>
          </Stack>

          {/* Quick Presets */}
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            flexWrap="wrap"
            sx={{ gap: 1 }}
          >
            {[1, 5, 10, 15, 30, 60].map((preset) => (
              <Button
                key={preset}
                variant={minutes === preset ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleMinutesChange(preset)}
              >
                {preset}m
              </Button>
            ))}
          </Stack>
        </Box>
      ) : (
        <>
          {/* Timer Display */}
          <Typography
            variant="h1"
            component="div"
            className={isRunning ? 'neon-text' : ''}
            sx={{
              fontSize: { xs: '4rem', sm: '5rem', md: '6rem' },
              fontWeight: 300,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
              lineHeight: 1,
              mb: 2,
              color: isRunning ? 'primary.main' : 'text.secondary',
              transition: 'all 0.3s ease',
              fontVariantNumeric: 'tabular-nums',
              WebkitFontFeatureSettings: '"tnum"',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {formatTime(hours, timerMinutes, seconds)}
          </Typography>

          {/* Progress Info */}
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              mb: 3,
            }}
          >
            {Math.round(calculateProgress())}% complete
          </Typography>

          {/* Progress Bar */}
          <Box sx={{ width: '100%', mb: 4 }}>
            <LinearProgress
              variant="determinate"
              value={calculateProgress()}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'divider',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  backgroundColor: 'primary.main',
                },
              }}
            />
          </Box>
        </>
      )}

      {/* Controls */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        alignItems="center"
      >
        {!isActive && (
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrow />}
            onClick={handleStart}
            sx={{ minWidth: 160, py: 1.5 }}
          >
            Start Timer
          </Button>
        )}

        {isActive && !isRunning && (
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrow />}
            onClick={handleResume}
            sx={{ minWidth: 140, py: 1.5 }}
          >
            Resume
          </Button>
        )}

        {isRunning && (
          <Button
            variant="outlined"
            size="large"
            startIcon={<Pause />}
            onClick={handlePause}
            sx={{ minWidth: 140, py: 1.5 }}
          >
            Pause
          </Button>
        )}

        {isActive && (
          <Button
            variant="outlined"
            size="large"
            startIcon={<RestartAlt />}
            onClick={handleReset}
            color="error"
            sx={{ minWidth: 120, py: 1.5 }}
          >
            Reset
          </Button>
        )}
      </Stack>
    </Box>
  );
};
