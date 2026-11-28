import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, IconButton, Tooltip, Button, Chip, Divider } from '@mui/material';
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
import { CircularTimerRing } from '../timer/CircularTimerRing';
import { AppSettings, SessionRecord, SessionType } from '@/features/timer/types';
import { services } from '@/services/domain';
import { useFocusTimerContext } from '@/features/timer/FocusTimerContext';
import { formatClock } from '@/features/timer/engine/format';
import dayjs from 'dayjs';
import { createLogger } from '@/services/logger';
import { RecentSessionsPanel } from './commandCenter/RecentSessionsPanel';
import { TodayStatsPanel } from './commandCenter/TodayStatsPanel';

const log = createLogger('CommandCenterLayout');

interface CommandCenterLayoutProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

/** Command Center layout; the timer itself is the app-wide `FocusTimerProvider`. */
export const CommandCenterLayout: React.FC<CommandCenterLayoutProps> = ({
  settings,
  onOpenSettings,
  onOpenHistory,
}) => {
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [todayStats, setTodayStats] = useState({ focusTime: 0, completed: 0 });
  const timer = useFocusTimerContext();
  const { plannedMinutes: totalDuration, setPlannedMinutes: setTotalDuration } = timer;
  const { isRunning, isPaused, isComplete, isBreak, actions } = timer;
  const isActive = timer.hasSession;

  const loadStats = async () => {
    try {
      const history = await services.history.today();
      if (history) {
        setTodayStats({
          focusTime: Math.round(history.totalFocusTime / 60),
          completed: history.completedSessions || 0,
        });
        setRecentSessions(history.sessions?.slice(-5).reverse() || []);
      }
    } catch (error) {
      log.error('Failed to load stats:', error);
    }
  };

  // Load on mount, and refresh when a plan finishes or is stopped
  useEffect(() => {
    if (timer.phase === 'idle' || timer.phase === 'complete') void loadStats();
  }, [timer.phase]);

  const startSession = () => actions.start(totalDuration, settings);
  const displayTime = formatClock(isActive ? timer.remainingSeconds : totalDuration * 60);
  const expectedEnd = dayjs(isActive ? timer.segmentEndsAt : Date.now() + totalDuration * 60_000);
  // Show completion screen when all sessions are done
  if (isComplete) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
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
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2, maxWidth: 400 }}>
            Great work! You've successfully completed your focus session.
          </Typography>
          <Typography variant="h6" sx={{ color: 'primary.main', mb: 4 }}>
            {todayStats.completed} sessions completed today
          </Typography>
          <Button variant="contained" size="large" onClick={actions.reset} sx={{ px: 4, py: 1.5 }}>
            Start New Session
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Command Center
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="History">
            <IconButton onClick={onOpenHistory} size="small">
              <History />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={onOpenSettings} size="small">
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Timer Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <CircularTimerRing
          progress={timer.progress}
          size={200}
          strokeWidth={6}
          isRunning={isRunning}
          isBreak={isBreak}
        >
          <Typography
            sx={{
              fontSize: '2.5rem',
              fontWeight: 200,
              fontFamily: 'ui-monospace, monospace',
              color: isActive ? (isBreak ? 'secondary.main' : 'primary.main') : 'text.secondary',
            }}
          >
            {displayTime}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {isActive ? (isBreak ? 'BREAK' : 'FOCUS') : 'READY'}
          </Typography>
        </CircularTimerRing>
      </Box>

      {/* Expected End Time */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
        <AccessTime fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ends at {expectedEnd.format('h:mm A')}
        </Typography>
      </Box>

      {/* Session Timeline */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: (t) => t.tokens.surface.card,
          backdropFilter: 'blur(12px)',
          border: (t) => `1px solid ${t.tokens.line.default}`,
        }}
      >
        <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Session Plan
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
          {timer.segments.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Start a session to see your plan
            </Typography>
          ) : (
            timer.segments.map((segment, index) => (
              <Chip
                key={segment.id}
                label={`${Math.round(segment.plannedDuration / 60)}m ${segment.type === SessionType.FOCUS ? 'focus' : 'break'}`}
                size="small"
                color={segment.type === SessionType.FOCUS ? 'primary' : 'secondary'}
                variant={index === timer.segmentIndex ? 'filled' : 'outlined'}
                sx={{
                  opacity: index < timer.segmentIndex ? 0.5 : 1,
                }}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Two Column Section */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
        <RecentSessionsPanel sessions={recentSessions} />
        <TodayStatsPanel focusMinutes={todayStats.focusTime} completed={todayStats.completed} />
      </Box>

      {/* Bottom Control Bar */}
      <Paper
        sx={{
          mt: 3,
          p: 2,
          backgroundColor: (t) => t.tokens.surface.panel,
          backdropFilter: 'blur(12px)',
          border: (t) => `1px solid ${t.tokens.line.default}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Duration Presets */}
        {!isActive && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(settings.quickPresets || [15, 25, 30, 45, 60]).map((preset) => (
              <Button
                key={preset}
                variant={totalDuration === preset ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setTotalDuration(preset)}
                sx={{ minWidth: 48 }}
              >
                {preset}m
              </Button>
            ))}
          </Box>
        )}

        <Divider
          orientation="vertical"
          flexItem
          sx={{ borderColor: (t) => t.tokens.line.default, mx: 2 }}
        />

        {/* Main Controls */}
        {!isActive && (
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrow />}
            onClick={startSession}
            sx={{ px: 4 }}
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
          >
            Resume
          </Button>
        )}

        {isRunning && (
          <>
            <IconButton
              aria-label="Pause"
              onClick={actions.pause}
              sx={{
                width: 48,
                height: 48,
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <Pause />
            </IconButton>
            <Tooltip title="Skip">
              <IconButton onClick={actions.skip} size="small">
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

        {isActive && (
          <Tooltip title="Stop">
            <IconButton onClick={actions.stop} size="small" sx={{ color: 'error.main' }}>
              <Stop />
            </IconButton>
          </Tooltip>
        )}
      </Paper>
    </Box>
  );
};
