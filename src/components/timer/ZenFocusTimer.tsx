import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Fade } from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  History,
  SkipNext,
  CheckCircleOutlined,
  FastForward,
  AccessTime,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { CircularTimerRing } from './CircularTimerRing';
import { AppSettings } from '@/features/timer/types';
import { useFocusTimerContext } from '@/features/timer/FocusTimerContext';
import { formatClock } from '@/features/timer/engine/format';

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
  const [showControls, setShowControls] = useState(false);
  const timer = useFocusTimerContext();
  const { plannedMinutes: totalDuration, setPlannedMinutes: setTotalDuration } = timer;
  const { isRunning, isPaused, isComplete, isBreak, hasSession, actions } = timer;
  const isActive = isRunning;

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const startSession = () => {
    actions.start(totalDuration, settings);
    setShowControls(true);
  };

  const resetToIdle = () => {
    actions.reset();
    setShowControls(false);
  };

  const stopSession = () => {
    actions.stop();
    setShowControls(false);
  };

  const displayTime = formatClock(hasSession ? timer.remainingSeconds : totalDuration * 60);
  const expectedEnd = dayjs(hasSession ? timer.segmentEndsAt : Date.now() + totalDuration * 60_000);
  const planEnd = timer.segmentCount > 1 && hasSession ? dayjs(timer.planEndsAt) : null;
  // Show completion screen when all sessions are done
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
        <CheckCircleOutlined
          sx={{
            fontSize: 100,
            color: 'success.main',
            mb: 3,
          }}
        />
        <Typography variant="h4" sx={{ fontWeight: 500, mb: 2 }}>
          Session Complete!
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, maxWidth: 300 }}>
          Great work! You've successfully completed your focus session.
        </Typography>
        <Button variant="contained" size="large" onClick={resetToIdle} sx={{ px: 4, py: 1.5 }}>
          Start New Session
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: 4,
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPaused && setShowControls(false)}
    >
      {/* Top Controls - Settings & History (hidden when in dashboard layout) */}
      {!hideTopControls && (
        <Fade in={showControls || !isActive}>
          <Box
            sx={{
              position: 'absolute',
              top: 24,
              right: 24,
              display: 'flex',
              gap: 1,
            }}
          >
            <Tooltip title="History">
              <IconButton onClick={onOpenHistory} size="small" sx={{ color: 'text.secondary' }}>
                <History />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={onOpenSettings} size="small" sx={{ color: 'text.secondary' }}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Fade>
      )}

      {/* Session Type Label */}
      <Typography
        variant="overline"
        sx={{
          color: isBreak ? 'secondary.main' : 'primary.main',
          letterSpacing: '0.2em',
          mb: 4,
          opacity: isActive ? 1 : 0.5,
          transition: 'all 0.3s ease',
        }}
      >
        {isActive ? (isBreak ? 'BREAK' : 'FOCUS') : 'READY'}
      </Typography>

      {/* Circular Timer */}
      <CircularTimerRing
        progress={timer.progress}
        size={300}
        strokeWidth={6}
        isRunning={isActive}
        isBreak={isBreak}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: '4rem',
            fontWeight: 200,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            color: isActive ? (isBreak ? 'secondary.main' : 'primary.main') : 'text.secondary',
            transition: 'all 0.3s ease',
          }}
        >
          {displayTime}
        </Typography>

        {/* Expected End Time */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}
        >
          <AccessTime fontSize="small" sx={{ color: 'text.secondary', fontSize: '0.875rem' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {timer.segmentCount > 1 && hasSession ? 'Segment ends ' : 'Ends at '}
            {expectedEnd.format('h:mm A')}
          </Typography>
        </Box>
        {/* Overall session plan end time */}
        {planEnd && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
            Session ends at {planEnd.format('h:mm A')}
          </Typography>
        )}

        {/* Session indicator */}
        {timer.segmentCount > 1 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {timer.segmentIndex + 1} / {timer.segmentCount}
          </Typography>
        )}
      </CircularTimerRing>

      {/* Controls */}
      <Fade in={showControls || !isActive || isPaused}>
        <Box sx={{ mt: 6, display: 'flex', gap: 2, alignItems: 'center' }}>
          {!hasSession && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={startSession}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem',
              }}
            >
              Start {totalDuration}m Focus
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

          {isActive && (
            <>
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

              <Tooltip title="Skip to next">
                <IconButton onClick={actions.skip} size="small" sx={{ color: 'text.secondary' }}>
                  <SkipNext />
                </IconButton>
              </Tooltip>

              {import.meta.env.DEV && (
                <Tooltip title="Fast forward -30s (Test)">
                  <IconButton
                    onClick={() => actions.fastForward()}
                    size="small"
                    sx={{ color: 'warning.main' }}
                  >
                    <FastForward />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}

          {(isActive || isPaused) && (
            <Tooltip title="Stop session">
              <IconButton onClick={stopSession} size="small" sx={{ color: 'error.main' }}>
                <Stop />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Fade>

      {/* Duration Quick Select (only when not active) */}
      <Fade in={!isActive && !isPaused}>
        <Box sx={{ mt: 4, display: 'flex', gap: 1 }}>
          {(settings.quickPresets || [15, 25, 30, 45, 60]).map((preset) => (
            <Button
              key={preset}
              variant={totalDuration === preset ? 'contained' : 'text'}
              size="small"
              onClick={() => setTotalDuration(preset)}
              sx={{
                minWidth: 48,
                color: totalDuration === preset ? undefined : 'text.secondary',
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
