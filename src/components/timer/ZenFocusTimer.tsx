import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  History,
  SkipNext,
  CheckCircleOutlined,
  FastForward,
} from '@mui/icons-material';
import { CircularTimerRing } from './CircularTimerRing';
import { AppSettings, formatTime } from '@/features/timer/types';
import { useFocusTimerContext } from '@/features/timer/FocusTimerContext';
import { focusSummary, formatClock } from '@/features/timer/engine/format';
import { motion, typography } from '@/theme/tokens';
import { ControlRow, REVEAL, revealStyles } from './ControlRow';

interface ZenFocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  settings: AppSettings;
  onRunningStateChange?: (isRunning: boolean) => void;
  hideTopControls?: boolean;
}

/** View for the focus timer; the timer itself is the app-wide `FocusTimerProvider`. */
export const ZenFocusTimer: React.FC<ZenFocusTimerProps> = ({
  onOpenSettings,
  onOpenHistory,
  settings,
  onRunningStateChange,
  hideTopControls = false,
}) => {
  const timer = useFocusTimerContext();
  const { plannedMinutes, setPlannedMinutes } = timer;
  const { isRunning, isPaused, isComplete, isBreak, hasSession, actions } = timer;

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const at = (ms: number) => formatTime(new Date(ms), settings.timeFormat);

  if (isComplete) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
        }}
      >
        <CheckCircleOutlined sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
          Done.
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          {focusSummary(timer.focusSecondsDone)}
        </Typography>
        <Button variant="contained" size="large" onClick={actions.reset}>
          Start another session
        </Button>
      </Box>
    );
  }

  const status = isPaused ? 'Paused' : isRunning ? (isBreak ? 'Break' : 'Focus') : 'Ready';
  const accent = isBreak ? 'secondary.main' : 'primary.main';
  const multiSegment = hasSession && timer.segmentCount > 1;
  const presets = settings.quickPresets?.length ? settings.quickPresets : [15, 25, 30, 45, 60];

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
      {!hideTopControls && (
        <Box
          className={REVEAL}
          // Anchored to the layout's corner (below any recovery banner), clear of the status line
          sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 0.5 }}
        >
          <Tooltip title="History">
            <IconButton
              aria-label="History"
              onClick={onOpenHistory}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <History fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton
              aria-label="Settings"
              onClick={onOpenSettings}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <Settings fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Typography
        component="p"
        aria-live="polite"
        sx={{
          ...typography.label,
          mb: 4,
          display: 'flex',
          gap: 1,
          color: 'text.secondary',
        }}
      >
        <Box
          component="span"
          data-testid="timer-status"
          sx={{
            color: isRunning ? accent : 'text.secondary',
            transition: `color ${motion.base} ${motion.easeOut}`,
          }}
        >
          {status}
        </Box>
        {multiSegment && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {timer.segmentIndex + 1} of {timer.segmentCount}
            </span>
          </>
        )}
      </Typography>

      <CircularTimerRing progress={timer.progress} size={300} strokeWidth={6} isBreak={isBreak}>
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
          {formatClock(hasSession ? timer.remainingSeconds : plannedMinutes * 60)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          {multiSegment ? 'This part ends ' : 'Ends '}
          {at(hasSession ? timer.segmentEndsAt : Date.now() + plannedMinutes * 60_000)}
        </Typography>
        {multiSegment && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
            Whole session ends {at(timer.planEndsAt)}
          </Typography>
        )}
      </CircularTimerRing>

      <ControlRow
        primary={
          hasSession ? (
            isPaused ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrow />}
                onClick={actions.resume}
              >
                Resume
              </Button>
            ) : (
              <Tooltip title="Pause (Space)">
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
            )
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={() => actions.start(plannedMinutes, settings)}
            >
              Start focus
            </Button>
          )
        }
        secondary={
          hasSession && (
            <>
              {isRunning && (
                <Tooltip title="Skip to next">
                  <IconButton
                    aria-label="Skip to next"
                    onClick={actions.skip}
                    sx={{ color: 'text.secondary' }}
                  >
                    <SkipNext />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Stop session">
                <IconButton
                  aria-label="Stop session"
                  onClick={actions.stop}
                  sx={{ color: 'text.secondary' }}
                >
                  <Stop />
                </IconButton>
              </Tooltip>
              {import.meta.env.DEV && isRunning && (
                <Tooltip title="Fast forward 30 s (development)">
                  <IconButton
                    aria-label="Fast forward"
                    onClick={() => actions.fastForward()}
                    sx={{ color: 'warning.main' }}
                  >
                    <FastForward />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )
        }
      />

      {/* Kept in the layout during a session so the timer does not jump */}
      <Box sx={{ mt: 3, visibility: hasSession ? 'hidden' : 'visible' }} aria-hidden={hasSession}>
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="Session length"
          value={plannedMinutes}
          onChange={(_, minutes: number | null) => minutes && setPlannedMinutes(minutes)}
        >
          {presets.map((preset) => (
            <ToggleButton key={preset} value={preset} sx={{ px: 1.75 }}>
              {preset} min
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};
