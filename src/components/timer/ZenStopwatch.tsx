import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Fade, Chip } from '@mui/material';
import { PlayArrow, Pause, RestartAlt, Flag } from '@mui/icons-material';
import { CircularTimerRing } from './CircularTimerRing';
import { useStopwatch } from '@/features/timer/hooks/useToolTimers';

interface ZenStopwatchProps {
  onRunningStateChange?: (isRunning: boolean) => void;
}

/** `mm:ss.cc`, or `hh:mm:ss` from an hour on. */
const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((milliseconds % 1000) / 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
};

/** View for the stopwatch tool; timing lives in `useStopwatch`. */
export const ZenStopwatch: React.FC<ZenStopwatchProps> = ({ onRunningStateChange }) => {
  const [showControls, setShowControls] = useState(true);
  const { isRunning, elapsedMs: time, laps, actions } = useStopwatch();

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  // The ring sweeps once per minute (for visual interest)
  const progress = ((Math.floor(time / 1000) % 60) / 60) * 100;
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
        progress={progress}
        size={300}
        strokeWidth={6}
        isRunning={isRunning}
        isBreak={false}
      >
        <Typography
          variant="h1"
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
            onClick={actions.toggle}
            sx={{ px: 4, py: 1.5 }}
          >
            {isRunning ? 'Pause' : time > 0 ? 'Resume' : 'Start'}
          </Button>

          {isRunning && (
            <Tooltip title="Lap">
              <IconButton
                onClick={actions.lap}
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
              <IconButton onClick={actions.reset} size="small" sx={{ color: 'error.main' }}>
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
