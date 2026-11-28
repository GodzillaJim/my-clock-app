import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  ArrowBack,
  LocalFireDepartment,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { formatDurationFromSeconds } from '@/features/timer/types';

interface MomentumHeaderProps {
  todayFocusSeconds: number;
  streakDays: number;
  avgDailyFocusSeconds: number;
  onClose: () => void;
}

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace';

export const MomentumHeader: React.FC<MomentumHeaderProps> = ({
  todayFocusSeconds,
  streakDays,
  avgDailyFocusSeconds,
  onClose,
}) => {
  const theme = useTheme();

  // How today compares to the user's own baseline.
  const delta = todayFocusSeconds - avgDailyFocusSeconds;
  const hasBaseline = avgDailyFocusSeconds > 0;
  const meaningful = Math.abs(delta) >= 5 * 60; // ignore sub-5-minute noise

  let compareText = 'no average yet';
  let CompareIcon = TrendingFlat;
  let compareColor = theme.palette.text.secondary;

  if (hasBaseline) {
    if (meaningful && delta > 0) {
      compareText = `${formatDurationFromSeconds(delta)} above your ${formatDurationFromSeconds(avgDailyFocusSeconds)} average`;
      CompareIcon = TrendingUp;
      compareColor = theme.palette.success.main;
    } else if (meaningful && delta < 0) {
      compareText = `${formatDurationFromSeconds(-delta)} below your ${formatDurationFromSeconds(avgDailyFocusSeconds)} average`;
      CompareIcon = TrendingDown;
      compareColor = theme.palette.text.secondary;
    } else {
      compareText = `right on your ${formatDurationFromSeconds(avgDailyFocusSeconds)} average`;
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Tooltip title="Back">
          <IconButton onClick={onClose} size="small" edge="start">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="overline" sx={{ letterSpacing: '0.18em', color: 'text.secondary' }}>
          History
        </Typography>
      </Box>

      <Box
        sx={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: { xs: 2, sm: 5 } }}
      >
        {/* Focal figure: today's focus */}
        <Box>
          <Typography
            sx={{
              fontFamily: MONO,
              fontWeight: 200,
              fontSize: { xs: '3rem', sm: '4rem' },
              lineHeight: 1,
              color: todayFocusSeconds > 0 ? 'primary.main' : 'text.secondary',
            }}
          >
            {todayFocusSeconds > 0 ? formatDurationFromSeconds(todayFocusSeconds) : '0m'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.1em' }}>
            FOCUSED TODAY
          </Typography>
        </Box>

        {/* Supporting facts, held apart by rhythm not by cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor:
                  streakDays > 0 ? alpha(theme.palette.warning.main, 0.14) : 'transparent',
              }}
            >
              <LocalFireDepartment
                sx={{ fontSize: 17, color: streakDays > 0 ? 'warning.main' : 'text.disabled' }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              <Box component="span" sx={{ fontWeight: 700, fontFamily: MONO }}>
                {streakDays}
              </Box>{' '}
              day{streakDays === 1 ? '' : 's'} streak
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 26, display: 'flex', justifyContent: 'center' }}>
              <CompareIcon sx={{ fontSize: 17, color: compareColor }} />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {compareText}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
