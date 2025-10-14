import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  RestartAlt,
  Flag,
} from '@mui/icons-material';

interface LapTime {
  id: number;
  time: number;
  lapDuration: number;
}

interface StopwatchProps {
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const Stopwatch: React.FC<StopwatchProps> = ({ onRunningStateChange }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<LapTime[]>([]);
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

  // Notify parent when running state changes
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
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
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

  const getFastestLap = (): number | null => {
    if (laps.length === 0) return null;
    return Math.min(...laps.map((lap) => lap.lapDuration));
  };

  const getSlowestLap = (): number | null => {
    if (laps.length === 0) return null;
    return Math.max(...laps.map((lap) => lap.lapDuration));
  };

  const fastestLap = getFastestLap();
  const slowestLap = getSlowestLap();

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
        {isRunning ? 'Running' : time > 0 ? 'Paused' : 'Ready'}
      </Typography>

      {/* Time Display */}
      <Typography
        variant="h1"
        component="div"
        sx={{
          fontSize: { xs: '3.5rem', sm: '4.5rem', md: '5.5rem' },
          fontWeight: 300,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
          lineHeight: 1,
          mb: 4,
          color: isRunning ? 'primary.main' : 'text.primary',
          transition: 'color 0.3s ease',
          fontVariantNumeric: 'tabular-nums',
          WebkitFontFeatureSettings: '"tnum"',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {formatTime(time)}
      </Typography>

      {/* Controls */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        alignItems="center"
        sx={{ mb: 4 }}
      >
        <Button
          variant={isRunning ? 'outlined' : 'contained'}
          size="large"
          startIcon={isRunning ? <Pause /> : <PlayArrow />}
          onClick={handleStartPause}
          sx={{ minWidth: 140, py: 1.5 }}
        >
          {isRunning ? 'Pause' : time > 0 ? 'Resume' : 'Start'}
        </Button>

        {time > 0 && (
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

        {isRunning && (
          <IconButton
            size="large"
            onClick={handleLap}
            color="primary"
            sx={{
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Flag />
          </IconButton>
        )}
      </Stack>

      {/* Laps */}
      {laps.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="h6"
            sx={{ mb: 2, textAlign: 'left', fontWeight: 500 }}
          >
            Laps ({laps.length})
          </Typography>
          <Paper
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              backgroundColor: 'background.paper',
            }}
          >
            {laps.map((lap) => {
              const isFastest = lap.lapDuration === fastestLap && laps.length > 1;
              const isSlowest = lap.lapDuration === slowestLap && laps.length > 1;

              return (
                <Box key={lap.id}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1.5,
                      px: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: 'text.secondary',
                          minWidth: 60,
                        }}
                      >
                        Lap {lap.id}
                      </Typography>
                      {isFastest && (
                        <Chip label="Fastest" size="small" color="success" />
                      )}
                      {isSlowest && (
                        <Chip label="Slowest" size="small" color="error" />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: isFastest
                            ? 'success.main'
                            : isSlowest
                            ? 'error.main'
                            : 'text.primary',
                          fontWeight: 500,
                        }}
                      >
                        +{formatTime(lap.lapDuration)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: 'text.secondary',
                          minWidth: 100,
                          textAlign: 'right',
                        }}
                      >
                        {formatTime(lap.time)}
                      </Typography>
                    </Box>
                  </Box>
                  {lap.id !== laps[laps.length - 1].id && <Divider />}
                </Box>
              );
            })}
          </Paper>
        </Box>
      )}
    </Box>
  );
};
