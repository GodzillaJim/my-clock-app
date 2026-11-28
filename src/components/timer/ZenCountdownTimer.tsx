import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Fade } from '@mui/material';
import { PlayArrow, Pause, RestartAlt, Add, Remove, AccessTime } from '@mui/icons-material';
import dayjs from 'dayjs';
import { CircularTimerRing } from './CircularTimerRing';
import { useCountdown } from '@/features/timer/hooks/useToolTimers';
import { formatClock } from '@/features/timer/engine/format';

interface ZenCountdownTimerProps {
  onRunningStateChange?: (isRunning: boolean) => void;
}

/** View for the countdown tool; timing lives in `useCountdown`. */
export const ZenCountdownTimer: React.FC<ZenCountdownTimerProps> = ({ onRunningStateChange }) => {
  const [minutes, setMinutes] = useState(5);
  const [showControls, setShowControls] = useState(true);
  const countdown = useCountdown();
  const { isActive, isRunning, isPaused, actions } = countdown;

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const handleMinutesChange = (delta: number) => {
    setMinutes((value) => Math.max(1, Math.min(480, value + delta)));
  };

  const expectedEnd = dayjs(isActive ? countdown.endsAt : Date.now() + minutes * 60_000);
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
        progress={countdown.progress}
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
                Ends at {expectedEnd.format('h:mm A')}
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
              {formatClock(countdown.remainingSeconds)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <AccessTime fontSize="small" sx={{ color: 'text.secondary', fontSize: '0.875rem' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ends at {expectedEnd.format('h:mm A')}
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
              onClick={() => actions.start(minutes * 60)}
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
              onClick={actions.resume}
              sx={{ px: 4, py: 1.5 }}
            >
              Resume
            </Button>
          )}

          {isRunning && (
            <IconButton
              aria-label="Pause"
              onClick={actions.pause}
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
              <IconButton onClick={actions.reset} size="small" sx={{ color: 'error.main' }}>
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
