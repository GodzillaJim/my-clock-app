import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
} from '@mui/material';
import {
  Timer as TimerIcon,
  LocalFireDepartment,
  CheckCircle,
  TrendingUp,
  Schedule,
  CalendarMonth,
  DoNotDisturb,
} from '@mui/icons-material';
import { LifetimeStats, formatDurationFromSeconds } from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, color = 'text.primary' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
    <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body1" fontWeight={600} sx={{ color }}>{value}</Typography>
    </Box>
  </Box>
);

interface PeriodCardProps {
  title: string;
  focusTime: number;
  sessions: number;
  avgDaily: number;
  completionRate: number;
  daysActive: number;
}

const PeriodCard: React.FC<PeriodCardProps> = ({
  title, focusTime, sessions, avgDaily, completionRate, daysActive
}) => (
  <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
    <Typography variant="subtitle2" gutterBottom>{title}</Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="body2">
        <strong>{formatDurationFromSeconds(focusTime)}</strong> focus time
      </Typography>
      <Typography variant="body2">
        <strong>{sessions}</strong> sessions across <strong>{daysActive}</strong> days
      </Typography>
      <Typography variant="body2">
        <strong>{formatDurationFromSeconds(avgDaily)}</strong> avg/day
      </Typography>
      <Typography variant="body2">
        <strong>{Math.round(completionRate * 100)}%</strong> completion rate
      </Typography>
    </Box>
  </Paper>
);

export const StatsOverview: React.FC = () => {
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const lifetimeStats = await focusStorage.recalculateLifetimeStats();
      setStats(lifetimeStats);
    } catch (error) {
      console.error('Failed to load lifetime stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">Loading stats...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Lifetime summary */}
      <Typography variant="h6" gutterBottom>Lifetime Summary</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <StatItem
            icon={<TimerIcon fontSize="small" />}
            label="Total Focus Time"
            value={formatDurationFromSeconds(stats.totalFocusTime)}
            color="primary.main"
          />
          <StatItem
            icon={<CheckCircle fontSize="small" />}
            label="Total Sessions"
            value={String(stats.totalSessions)}
            color="success.main"
          />
          <StatItem
            icon={<CalendarMonth fontSize="small" />}
            label="Days Active"
            value={String(stats.totalDaysActive)}
          />
          <StatItem
            icon={<DoNotDisturb fontSize="small" />}
            label="Interrupted Sessions"
            value={String(stats.totalInterruptedSessions)}
            color="error.main"
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <StatItem
            icon={<Schedule fontSize="small" />}
            label="Avg Day Start"
            value={stats.averageDayStartTime}
          />
          <StatItem
            icon={<Schedule fontSize="small" />}
            label="Avg Day End"
            value={stats.averageDayEndTime}
          />
          <StatItem
            icon={<TrendingUp fontSize="small" />}
            label="Avg Daily Focus"
            value={formatDurationFromSeconds(stats.averageDailyFocusTime)}
            color="primary.main"
          />
          <StatItem
            icon={<TrendingUp fontSize="small" />}
            label="Avg Session Duration"
            value={formatDurationFromSeconds(stats.averageSessionDuration)}
          />
        </Box>
      </Box>

      {/* Streaks */}
      <Divider sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>Streaks</Typography>
      <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
        <StatItem
          icon={<LocalFireDepartment fontSize="small" />}
          label="Current Day Streak"
          value={`${stats.currentDayStreak} day${stats.currentDayStreak !== 1 ? 's' : ''}`}
          color="warning.main"
        />
        <StatItem
          icon={<LocalFireDepartment fontSize="small" />}
          label="Longest Day Streak"
          value={`${stats.longestDayStreak} day${stats.longestDayStreak !== 1 ? 's' : ''}`}
          color="warning.main"
        />
        <StatItem
          icon={<CheckCircle fontSize="small" />}
          label="Overall Completion Rate"
          value={`${Math.round(stats.overallCompletionRate * 100)}%`}
          color="success.main"
        />
      </Box>

      {/* Period comparisons */}
      <Divider sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>Period Comparison</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <PeriodCard
          title="Last 7 Days"
          focusTime={stats.last7Days.totalFocusTime}
          sessions={stats.last7Days.totalSessions}
          avgDaily={stats.last7Days.averageDailyFocusTime}
          completionRate={stats.last7Days.completionRate}
          daysActive={stats.last7Days.daysActive}
        />
        <PeriodCard
          title="Last 30 Days"
          focusTime={stats.last30Days.totalFocusTime}
          sessions={stats.last30Days.totalSessions}
          avgDaily={stats.last30Days.averageDailyFocusTime}
          completionRate={stats.last30Days.completionRate}
          daysActive={stats.last30Days.daysActive}
        />
      </Box>
    </Box>
  );
};
