import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { SessionRecord } from '@/features/timer/types';

/** Today's latest sessions, newest first. */
export const RecentSessionsPanel: React.FC<{ sessions: SessionRecord[] }> = ({ sessions }) => (
  <Paper
    sx={{
      flex: 1,
      p: 2,
      backgroundColor: 'rgba(24, 24, 28, 0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1 }}>
      Recent Sessions
    </Typography>
    <Box sx={{ flex: 1, overflowY: 'auto' }}>
      {sessions.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No sessions yet today
        </Typography>
      ) : (
        sessions.map((session, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 1,
              borderBottom:
                index < sessions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: session.type === 'focus' ? 'primary.main' : 'secondary.main',
                }}
              />
              <Typography variant="body2">
                {session.type === 'focus' ? 'Focus' : 'Break'}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {Math.round(session.plannedDuration / 60)}m
            </Typography>
          </Box>
        ))
      )}
    </Box>
  </Paper>
);
