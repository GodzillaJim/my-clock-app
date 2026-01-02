import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Close, CheckCircle, Cancel } from '@mui/icons-material';
import { Challenge, ChallengeDay, ChallengeDayStatus } from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { ChallengeCalendar } from './ChallengeCalendar';
import dayjs from 'dayjs';

interface ChallengeDetailDialogProps {
  open: boolean;
  challenge: Challenge;
  onClose: () => void;
  onUpdate: () => void;
}

export const ChallengeDetailDialog: React.FC<ChallengeDetailDialogProps> = ({
  open,
  challenge,
  onClose,
  onUpdate,
}) => {
  const [selectedDay, setSelectedDay] = useState<ChallengeDay | null>(null);
  const [dayStatus, setDayStatus] = useState<ChallengeDayStatus>(ChallengeDayStatus.PENDING);
  const [dayNote, setDayNote] = useState('');

  const handleDayClick = (day: ChallengeDay) => {
    setSelectedDay(day);
    setDayStatus(day.status);
    setDayNote(day.note || '');
  };

  const handleSaveDay = async () => {
    if (!selectedDay) return;

    await focusStorage.markChallengeDay(
      challenge.id,
      selectedDay.date,
      dayStatus,
      dayNote.trim() || undefined
    );

    setSelectedDay(null);
    setDayNote('');
    onUpdate();
  };

  const handleCancelDayEdit = () => {
    setSelectedDay(null);
    setDayNote('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {challenge.name}
            </Typography>
            {challenge.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {challenge.description}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Stats Row */}
        <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="success.main" fontWeight={600}>
              {challenge.completedDays}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Days Completed
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="error.main" fontWeight={600}>
              {challenge.failedDays}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Days Failed
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="warning.main" fontWeight={600}>
              {challenge.currentStreak}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Current Streak
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="primary.main" fontWeight={600}>
              {challenge.longestStreak}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Best Streak
            </Typography>
          </Box>
        </Box>

        {/* Calendar Grid */}
        <Typography variant="subtitle2" gutterBottom>
          Progress Calendar
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Click on a day to mark it as completed or failed
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ChallengeCalendar
            days={challenge.days}
            onDayClick={handleDayClick}
          />
        </Box>

        {/* Day Marking Form */}
        {selectedDay && (
          <Box
            sx={{
              p: 2,
              backgroundColor: 'action.hover',
              borderRadius: 2,
              mt: 2,
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Mark {dayjs(selectedDay.date).format('MMMM D, YYYY')}
            </Typography>

            <ToggleButtonGroup
              value={dayStatus}
              exclusive
              onChange={(_, value) => value && setDayStatus(value)}
              fullWidth
              sx={{ mb: 2 }}
            >
              <ToggleButton value={ChallengeDayStatus.COMPLETED} color="success">
                <CheckCircle sx={{ mr: 1 }} />
                Completed
              </ToggleButton>
              <ToggleButton value={ChallengeDayStatus.FAILED} color="error">
                <Cancel sx={{ mr: 1 }} />
                Failed
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              fullWidth
              size="small"
              label="Note (optional)"
              value={dayNote}
              onChange={(e) => setDayNote(e.target.value)}
              placeholder="How did today go?"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={handleCancelDayEdit}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleSaveDay}>
                Save
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {dayjs(challenge.startDate).format('MMM D')} - {dayjs(challenge.endDate).format('MMM D, YYYY')}
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
