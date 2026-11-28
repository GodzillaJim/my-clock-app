import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { PlayArrow, Pause, RestartAlt, Add, Remove } from '@mui/icons-material';
import { CircularTimerRing } from './CircularTimerRing';
import { useCountdown } from '@/features/timer/hooks/useToolTimers';
import { formatClock } from '@/features/timer/engine/format';
import { formatTime, type AppSettings } from '@/features/timer/types';
import { motion, typography } from '@/theme/tokens';
import { ControlRow, revealStyles } from './ControlRow';

interface ZenCountdownTimerProps {
  onRunningStateChange?: (isRunning: boolean) => void;
  timeFormat?: AppSettings['timeFormat'];
}

const PRESETS = [1, 5, 10, 15, 30, 60];

/** View for the countdown tool; timing lives in `useCountdown`. */
export const ZenCountdownTimer: React.FC<ZenCountdownTimerProps> = ({
  onRunningStateChange,
  timeFormat = '12h',
}) => {
  const [minutes, setMinutes] = useState(5);
  const countdown = useCountdown();
  const { isActive, isRunning, isPaused, actions } = countdown;

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const changeMinutes = (delta: number) => {
    setMinutes((value) => Math.max(1, Math.min(480, value + delta)));
  };

  const endsAt = formatTime(
    new Date(isActive ? countdown.endsAt : Date.now() + minutes * 60_000),
    timeFormat,
  );
  const status = isRunning ? 'Running' : isPaused ? 'Paused' : 'Timer';

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

      <CircularTimerRing progress={countdown.progress} size={300} strokeWidth={6}>
        {!isActive ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                aria-label="One minute less"
                onClick={() => changeMinutes(-1)}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <Remove />
              </IconButton>
              <Typography
                component="p"
                sx={{
                  ...typography.timer,
                  fontSize: '3.5rem',
                  color: 'text.primary',
                  minWidth: 150,
                  textAlign: 'center',
                }}
              >
                {minutes}
                <Box
                  component="span"
                  sx={{ fontSize: '1.25rem', ml: 0.75, color: 'text.secondary' }}
                >
                  min
                </Box>
              </Typography>
              <IconButton
                aria-label="One minute more"
                onClick={() => changeMinutes(1)}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <Add />
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Ends {endsAt}
            </Typography>
          </Box>
        ) : (
          <>
            <Typography
              variant="h1"
              component="p"
              role="timer"
              sx={{
                ...typography.timer,
                fontSize: '4.5rem',
                color: isRunning ? 'text.primary' : 'text.secondary',
                transition: `color ${motion.base} ${motion.easeOut}`,
              }}
            >
              {formatClock(countdown.remainingSeconds)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
              Ends {endsAt}
            </Typography>
          </>
        )}
      </CircularTimerRing>

      <ControlRow
        primary={
          isRunning ? (
            <Tooltip title="Pause">
              <IconButton
                aria-label="Pause"
                onClick={actions.pause}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'text.primary',
                }}
              >
                <Pause />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={isPaused ? actions.resume : () => actions.start(minutes * 60)}
            >
              {isPaused ? 'Resume' : 'Start timer'}
            </Button>
          )
        }
        secondary={
          isActive && (
            <Tooltip title="Reset">
              <IconButton
                aria-label="Reset"
                onClick={actions.reset}
                sx={{ color: 'text.secondary' }}
              >
                <RestartAlt />
              </IconButton>
            </Tooltip>
          )
        }
      />

      <Box sx={{ mt: 3, visibility: isActive ? 'hidden' : 'visible' }} aria-hidden={isActive}>
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="Timer length"
          value={minutes}
          onChange={(_, value: number | null) => value && setMinutes(value)}
        >
          {PRESETS.map((preset) => (
            <ToggleButton key={preset} value={preset} sx={{ px: 1.75 }}>
              {preset} min
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};
