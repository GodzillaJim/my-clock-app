import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Fade, Chip } from '@mui/material';
import { PlayArrow, Pause, RestartAlt, Flag } from '@mui/icons-material';
import { CircularTimerRing } from './CircularTimerRing';
import { persistenceService } from '@/services/persistenceService';

const STOPWATCH_SNAPSHOT_KEY = 'STOPWATCH_SNAPSHOT';

interface LapTime {
  id: number;
  time: number;
  lapDuration: number;
}

interface ZenStopwatchProps {
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const ZenStopwatch: React.FC<ZenStopwatchProps> = ({ onRunningStateChange }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<LapTime[]>([]);
  const [showControls, setShowControls] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLapTimeRef = useRef(0);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 10);
      }, 10);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
    lastLapTimeRef.current = 0;
    persistenceService.clearSnapshot(STOPWATCH_SNAPSHOT_KEY);
  };

  const handleLap = () => {
    if (isRunning) {
      const lapDuration = time - lastLapTimeRef.current;
      setLaps((prevLaps) => [
        {
          id: prevLaps.length + 1,
          time: time,
          lapDuration: lapDuration,
        },
        ...prevLaps,
      ]);
      lastLapTimeRef.current = time;
    }
  };

  // Progress is based on seconds within the current minute (for visual interest)
  const calculateProgress = (): number => {
    const totalSeconds = Math.floor(time / 1000);
    const secondsInMinute = totalSeconds % 60;
    return (secondsInMinute / 60) * 100;
  };

  const isActive = time > 0 || isRunning;

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
      onMouseLeave={() => isRunning && setShowControls(false)}
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
        {isRunning ? 'RUNNING' : time > 0 ? 'PAUSED' : 'STOPWATCH'}
      </Typography>

      {/* Circular Timer */}
      <CircularTimerRing
        progress={calculateProgress()}
        size={300}
        strokeWidth={6}
        isRunning={isRunning}
        isBreak={false}
      >
        <Typography
          variant="h1"
          className={isRunning ? 'neon-text' : ''}
          sx={{
            fontSize: '3.5rem',
            fontWeight: 200,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            color: isRunning ? 'primary.main' : 'text.primary',
            transition: 'all 0.3s ease',
          }}
        >
          {formatTime(time)}
        </Typography>

        {laps.length > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
            Lap {laps.length}
          </Typography>
        )}
      </CircularTimerRing>

      {/* Controls */}
      <Fade in={showControls || !isRunning}>
        <Box sx={{ mt: 6, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant={isRunning ? 'outlined' : 'contained'}
            size="large"
            startIcon={isRunning ? <Pause /> : <PlayArrow />}
            onClick={handleStartPause}
            sx={{ px: 4, py: 1.5 }}
          >
            {isRunning ? 'Pause' : time > 0 ? 'Resume' : 'Start'}
          </Button>

          {isRunning && (
            <Tooltip title="Lap">
              <IconButton
                onClick={handleLap}
                sx={{
                  width: 48,
                  height: 48,
                  border: '1px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Flag />
              </IconButton>
            </Tooltip>
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

      {/* Laps Display */}
      {laps.length > 0 && (
        <Fade in={true}>
          <Box
            sx={{
              mt: 4,
              maxHeight: 120,
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'center',
              px: 2,
            }}
          >
            {laps.slice(0, 8).map((lap) => (
              <Chip
                key={lap.id}
                label={`Lap ${lap.id}: +${formatTime(lap.lapDuration)}`}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace' }}
              />
            ))}
            {laps.length > 8 && (
              <Chip label={`+${laps.length - 8} more`} size="small" variant="outlined" />
            )}
          </Box>
        </Fade>
      )}
    </Box>
  );
};
