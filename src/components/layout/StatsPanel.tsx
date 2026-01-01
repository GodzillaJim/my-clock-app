import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';
import {
  Timer as TimerIcon,
  LocalFireDepartment,
  CheckCircle,
  TrendingUp,
} from '@mui/icons-material';
import { focusStorage } from '@/services/focusStorage';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext, color = 'primary.main' }) => (
  <Paper
    sx={{
      p: 2,
      backgroundColor: 'rgba(24, 24, 28, 0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
      {icon}
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
    </Box>
    <Typography
      variant="h4"
      sx={{
        fontWeight: 600,
        color,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {value}
    </Typography>
    {subtext && (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {subtext}
      </Typography>
    )}
  </Paper>
);

export const StatsPanel: React.FC = () => {
  const [stats, setStats] = useState({
    todayFocus: '0h 0m',
    streak: 0,
    completed: 0,
    weeklyAvg: '0h',
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const history = await focusStorage.getTodayHistory();
      if (history) {
        const totalMinutes = Math.round(history.totalFocusTime / 60);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        setStats({
          todayFocus: `${hours}h ${mins}m`,
          streak: history.longestStreak || 0,
          completed: history.completedSessions || 0,
          weeklyAvg: '2h', // Placeholder - would need weekly data
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  return (
    <Box
      sx={{
        width: 240,
        minHeight: '100vh',
        backgroundColor: 'rgba(18, 18, 22, 0.6)',
        backdropFilter: 'blur(8px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          color: 'text.secondary',
          letterSpacing: '0.1em',
          mb: 1,
        }}
      >
        Today's Progress
      </Typography>

      <StatCard
        icon={<TimerIcon fontSize="small" />}
        label="Focus Time"
        value={stats.todayFocus}
        subtext="Total time focused today"
        color="primary.main"
      />

      <StatCard
        icon={<LocalFireDepartment fontSize="small" />}
        label="Streak"
        value={`${stats.streak}`}
        subtext="Consecutive sessions"
        color="warning.main"
      />

      <StatCard
        icon={<CheckCircle fontSize="small" />}
        label="Completed"
        value={`${stats.completed}`}
        subtext="Sessions today"
        color="success.main"
      />

      <StatCard
        icon={<TrendingUp fontSize="small" />}
        label="Weekly Avg"
        value={stats.weeklyAvg}
        subtext="Per day this week"
        color="secondary.main"
      />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Motivational Quote */}
      <Paper
        sx={{
          p: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontStyle: 'italic',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          "The secret of getting ahead is getting started."
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'primary.main', display: 'block', mt: 1 }}
        >
          — Mark Twain
        </Typography>
      </Paper>
    </Box>
  );
};
