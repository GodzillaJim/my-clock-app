import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { EmojiEvents } from '@mui/icons-material';
import {
  ChallengeDurationPreset,
  createChallengeDays,
  ChallengeStatus,
  ChallengeDay,
} from '@/features/timer/types';
import { createLogger } from '@/services/logger';

const log = createLogger('CreateChallengeDialog');

interface CreateChallengeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (challenge: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    status: ChallengeStatus;
    days: ChallengeDay[];
  }) => Promise<void>;
}

export const CreateChallengeDialog: React.FC<CreateChallengeDialogProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationType, setDurationType] = useState<ChallengeDurationPreset>(30);
  const [startDate, setStartDate] = useState<Dayjs>(dayjs());
  const [customEndDate, setCustomEndDate] = useState<Dayjs>(dayjs().add(30, 'day'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getEndDate = (): Dayjs => {
    if (durationType === 'custom') {
      return customEndDate;
    }
    return startDate.add(durationType - 1, 'day');
  };

  const getDurationDays = (): number => {
    if (durationType === 'custom') {
      return customEndDate.diff(startDate, 'day') + 1;
    }
    return durationType;
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const start = startDate.format('YYYY-MM-DD');
      const end = getEndDate().format('YYYY-MM-DD');

      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: start,
        endDate: end,
        durationDays: getDurationDays(),
        status: ChallengeStatus.ACTIVE,
        days: createChallengeDays(start, end),
      });

      handleClose();
    } catch (error) {
      log.error('Failed to create challenge:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setDurationType(30);
    setStartDate(dayjs());
    setCustomEndDate(dayjs().add(30, 'day'));
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEvents color="primary" />
            Create New Challenge
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Challenge Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 30 Days of Meditation"
              error={!name.trim() && name !== ''}
              helperText={!name.trim() && name !== '' ? 'Name is required' : ''}
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this challenge about?"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Duration
              </Typography>
              <ToggleButtonGroup
                value={durationType}
                exclusive
                onChange={(_, value) => value && setDurationType(value)}
                fullWidth
                size="small"
              >
                <ToggleButton value={7}>7 Days</ToggleButton>
                <ToggleButton value={30}>30 Days</ToggleButton>
                <ToggleButton value={90}>90 Days</ToggleButton>
                <ToggleButton value="custom">Custom</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(value) => value && setStartDate(value)}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />

              {durationType === 'custom' ? (
                <DatePicker
                  label="End Date"
                  value={customEndDate}
                  onChange={(value) => value && setCustomEndDate(value)}
                  minDate={startDate.add(1, 'day')}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label="End Date"
                  value={getEndDate().format('MMM D, YYYY')}
                  disabled
                />
              )}
            </Box>

            <Box sx={{ p: 2, backgroundColor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Challenge will run for <strong>{getDurationDays()} days</strong> from{' '}
                <strong>{startDate.format('MMM D')}</strong> to{' '}
                <strong>{getEndDate().format('MMM D, YYYY')}</strong>
              </Typography>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Create Challenge'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};
