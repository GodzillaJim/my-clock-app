import React, { useEffect } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Chip } from '@mui/material';
import { PlayArrow, Pause, RestartAlt, Flag } from '@mui/icons-material';
import { CircularTimerRing } from './CircularTimerRing';
import { useStopwatch } from '@/features/timer/hooks/useToolTimers';
import { motion, typography } from '@/theme/tokens';
import { ControlRow, revealStyles } from './ControlRow';

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
  const { isRunning, elapsedMs: time, laps, actions } = useStopwatch();

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  // The ring sweeps once per minute
  const progress = ((Math.floor(time / 1000) % 60) / 60) * 100;
  const isActive = time > 0 || isRunning;
  const status = isRunning ? 'Running' : time > 0 ? 'Paused' : 'Stopwatch';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        ...revealStyles(isRunning),
      }}
    >
      <Typography
        component="p"
        aria-live="polite"
        sx={{ ...typography.label, mb: 4, color: isRunning ? 'primary.main' : 'text.secondary' }}
      >
        {status}
      </Typography>

      <CircularTimerRing progress={progress} size={300} strokeWidth={6}>
        <Typography
          variant="h1"
          component="p"
          role="timer"
          sx={{
            ...typography.timer,
            fontSize: '3.75rem',
            color: isRunning ? 'text.primary' : 'text.secondary',
            transition: `color ${motion.base} ${motion.easeOut}`,
          }}
        >
          {formatTime(time)}
        </Typography>
        {laps.length > 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
            Lap {laps.length}
          </Typography>
        )}
      </CircularTimerRing>

      <ControlRow
        primary={
          <Button
            variant={isRunning ? 'outlined' : 'contained'}
            size="large"
            startIcon={isRunning ? <Pause /> : <PlayArrow />}
            onClick={actions.toggle}
            sx={isRunning ? { borderRadius: 999, px: 3 } : undefined}
          >
            {isRunning ? 'Pause' : time > 0 ? 'Resume' : 'Start'}
          </Button>
        }
        secondary={
          isActive && (
            <>
              {isRunning && (
                <Tooltip title="Lap">
                  <IconButton
                    aria-label="Lap"
                    onClick={actions.lap}
                    sx={{ color: 'text.secondary' }}
                  >
                    <Flag />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Reset">
                <IconButton
                  aria-label="Reset"
                  onClick={actions.reset}
                  sx={{ color: 'text.secondary' }}
                >
                  <RestartAlt />
                </IconButton>
              </Tooltip>
            </>
          )
        }
      />

      {laps.length > 0 && (
        <Box
          component="ol"
          aria-label="Laps"
          sx={{
            mt: 3,
            p: 0,
            listStyle: 'none',
            maxHeight: 120,
            overflowY: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center',
          }}
        >
          {laps.slice(0, 8).map((lap) => (
            <li key={lap.id}>
              <Chip
                label={`Lap ${lap.id}  +${formatTime(lap.lapDuration)}`}
                size="small"
                variant="outlined"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </li>
          ))}
          {laps.length > 8 && (
            <li>
              <Chip label={`${laps.length - 8} more`} size="small" variant="outlined" />
            </li>
          )}
        </Box>
      )}
    </Box>
  );
};
