import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  LocalFireDepartment,
  MoreVert,
} from '@mui/icons-material';
import { Challenge, ChallengeStatus } from '@/features/timer/types';
import dayjs from 'dayjs';

interface ChallengeCardProps {
  challenge: Challenge;
  onClick: () => void;
  onMenuClick?: (event: React.MouseEvent) => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onClick,
  onMenuClick,
}) => {
  const progress = challenge.days.length > 0
    ? (challenge.completedDays / challenge.days.length) * 100
    : 0;
  const daysRemaining = dayjs(challenge.endDate).diff(dayjs(), 'day');

  const getStatusColor = (): 'primary' | 'success' | 'error' | 'warning' | 'default' => {
    switch (challenge.status) {
      case ChallengeStatus.ACTIVE: return 'primary';
      case ChallengeStatus.COMPLETED: return 'success';
      case ChallengeStatus.FAILED: return 'error';
      case ChallengeStatus.PAUSED: return 'warning';
      default: return 'default';
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.shadows[4],
        },
      }}
      onClick={onClick}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {challenge.name}
          </Typography>
          {challenge.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {challenge.description}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={challenge.status}
            size="small"
            color={getStatusColor()}
            variant="outlined"
            sx={{ textTransform: 'capitalize' }}
          />
          {onMenuClick && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(e);
              }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Progress
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {challenge.completedDays} / {challenge.days.length} days
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Tooltip title="Current streak">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocalFireDepartment fontSize="small" color="warning" />
            <Typography variant="body2">
              {challenge.currentStreak} day streak
            </Typography>
          </Box>
        </Tooltip>
        {challenge.status === ChallengeStatus.ACTIVE && daysRemaining >= 0 && (
          <Typography variant="body2" color="text.secondary">
            {daysRemaining} days remaining
          </Typography>
        )}
        {challenge.status === ChallengeStatus.ACTIVE && daysRemaining < 0 && (
          <Typography variant="body2" color="warning.main">
            Challenge ended - mark remaining days
          </Typography>
        )}
      </Box>
    </Paper>
  );
};
