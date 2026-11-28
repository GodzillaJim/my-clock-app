import React, { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Warning, Close, ExpandMore, ExpandLess, PlayArrow } from '@mui/icons-material';
import { RecoveryInfo } from '@/features/timer/hooks/useRecovery';
import { SessionType } from '@/features/timer/types';

interface RecoveryBannerProps {
  recovery: RecoveryInfo;
  onDismiss: () => void;
  onResume: () => void;
}

export const RecoveryBanner: React.FC<RecoveryBannerProps> = ({
  recovery,
  onDismiss,
  onResume,
}) => {
  const [expanded, setExpanded] = useState(false);

  const progress =
    recovery.totalSegments > 0 ? (recovery.completedSegments / recovery.totalSegments) * 100 : 0;

  return (
    <Alert
      severity="warning"
      icon={<Warning />}
      action={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {recovery.remainingSegments > 0 && (
            <Button
              color="inherit"
              size="small"
              onClick={onResume}
              startIcon={<PlayArrow />}
              sx={{ fontWeight: 600 }}
            >
              Resume
            </Button>
          )}
          <Button color="inherit" size="small" onClick={onDismiss} startIcon={<Close />}>
            Dismiss
          </Button>
        </Box>
      }
      sx={{ mb: 2, mx: 2 }}
    >
      <AlertTitle>Session Interrupted</AlertTitle>
      <Typography variant="body2">
        Your last session was interrupted at {recovery.interruptedAtFormatted}. You completed{' '}
        {recovery.completedSegments}/{recovery.totalSegments} segments (
        {recovery.completedTimeFormatted} of focus).
        {recovery.remainingSegments > 0 && (
          <>
            {' '}
            {recovery.remainingSegments} segments ({recovery.remainingTimeFormatted}) remained. The
            session was planned to end at {recovery.plannedEndFormatted}.
          </>
        )}
      </Typography>

      <Box sx={{ mt: 1 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 3, mb: 1 }}
        />
        <Button
          size="small"
          onClick={() => setExpanded(!expanded)}
          endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
          sx={{ textTransform: 'none', p: 0 }}
        >
          {expanded ? 'Hide' : 'View'} segment details
        </Button>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {recovery.plan.segments.map((seg, idx) => (
            <Box
              key={seg.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                opacity: seg.status === 'pending' ? 0.5 : 1,
              }}
            >
              <Typography variant="caption" sx={{ width: 20, textAlign: 'right' }}>
                {idx + 1}.
              </Typography>
              <Chip
                label={seg.type === SessionType.FOCUS ? 'Focus' : 'Break'}
                size="small"
                color={seg.type === SessionType.FOCUS ? 'primary' : 'secondary'}
                variant="outlined"
                sx={{ minWidth: 60 }}
              />
              <Chip
                label={seg.status}
                size="small"
                color={
                  seg.status === 'completed'
                    ? 'success'
                    : seg.status === 'interrupted'
                      ? 'error'
                      : seg.status === 'skipped'
                        ? 'warning'
                        : 'default'
                }
                variant="filled"
                sx={{ minWidth: 80 }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {Math.round(seg.plannedDuration / 60)}m planned
                {seg.actualDuration !== null && (
                  <> / {Math.round(seg.actualDuration / 60)}m actual</>
                )}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Alert>
  );
};
