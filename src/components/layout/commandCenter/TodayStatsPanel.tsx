import React from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';

interface TodayStatsPanelProps {
  focusMinutes: number;
  completed: number;
}

/** Today's focus time and completed sessions. */
export const TodayStatsPanel: React.FC<TodayStatsPanelProps> = ({ focusMinutes, completed }) => (
  <Paper
    sx={{
      flex: 1,
      p: 2,
      backgroundColor: 'rgba(24, 24, 28, 0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}
  >
    <Typography variant="overline" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
      Today's Stats
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 600 }}>
          {Math.floor(focusMinutes / 60)}h {focusMinutes % 60}m
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Total Focus Time
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <Box>
        <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 600 }}>
          {completed}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Completed Sessions
        </Typography>
      </Box>
    </Box>
  </Paper>
);
