import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Alert,
  Paper,
  IconButton,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add,
  EmojiEvents,
  Close,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { Challenge, ChallengeStatus, ChallengeDay, ChallengeDayStatus } from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { ChallengeCard } from './ChallengeCard';
import { ChallengeCalendar } from './ChallengeCalendar';
import { CreateChallengeDialog } from './CreateChallengeDialog';
import dayjs from 'dayjs';

export const ChallengesView: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuChallenge, setMenuChallenge] = useState<Challenge | null>(null);
  const [selectedDay, setSelectedDay] = useState<ChallengeDay | null>(null);
  const [dayStatus, setDayStatus] = useState<ChallengeDayStatus>(ChallengeDayStatus.PENDING);
  const [dayNote, setDayNote] = useState('');

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      const data = await focusStorage.getChallenges();
      setChallenges(data);
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredChallenges = () => {
    switch (tab) {
      case 0:
        return challenges.filter(c => c.status === ChallengeStatus.ACTIVE);
      case 1:
        return challenges.filter(c =>
          c.status === ChallengeStatus.COMPLETED || c.status === ChallengeStatus.FAILED
        );
      default:
        return challenges;
    }
  };

  const filteredChallenges = getFilteredChallenges();

  const handleCreateChallenge = async (challengeData: Parameters<typeof focusStorage.createChallenge>[0]) => {
    await focusStorage.createChallenge(challengeData);
    await loadChallenges();
  };

  const handleDeleteChallenge = async () => {
    if (!menuChallenge) return;
    await focusStorage.deleteChallenge(menuChallenge.id);
    setMenuAnchor(null);
    setMenuChallenge(null);
    if (selectedChallenge?.id === menuChallenge.id) {
      setSelectedChallenge(null);
    }
    await loadChallenges();
  };

  const handleDayClick = (day: ChallengeDay) => {
    setSelectedDay(day);
    setDayStatus(day.status);
    setDayNote(day.note || '');
  };

  const handleSaveDay = async () => {
    if (!selectedDay || !selectedChallenge) return;

    await focusStorage.markChallengeDay(
      selectedChallenge.id,
      selectedDay.date,
      dayStatus,
      dayNote.trim() || undefined
    );

    setSelectedDay(null);
    setDayNote('');
    await loadChallenges();
    const updated = await focusStorage.getChallengeById(selectedChallenge.id);
    if (updated) {
      setSelectedChallenge(updated);
    }
  };

  const handleCancelDayEdit = () => {
    setSelectedDay(null);
    setDayNote('');
  };

  const activeCount = challenges.filter(c => c.status === ChallengeStatus.ACTIVE).length;
  const completedCount = challenges.filter(c =>
    c.status === ChallengeStatus.COMPLETED || c.status === ChallengeStatus.FAILED
  ).length;

  // Detail view when a challenge is selected
  if (selectedChallenge) {
    return (
      <Box sx={{ width: '100%', maxWidth: 600 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Button
              size="small"
              onClick={() => setSelectedChallenge(null)}
              sx={{ mb: 1, ml: -1 }}
            >
              Back to Challenges
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {selectedChallenge.name}
            </Typography>
            {selectedChallenge.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {selectedChallenge.description}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Stats Row */}
        <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="success.main" fontWeight={600}>
              {selectedChallenge.completedDays}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Completed
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="error.main" fontWeight={600}>
              {selectedChallenge.failedDays}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Failed
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="warning.main" fontWeight={600}>
              {selectedChallenge.currentStreak}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Current Streak
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography variant="h4" color="primary.main" fontWeight={600}>
              {selectedChallenge.longestStreak}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Best Streak
            </Typography>
          </Box>
        </Box>

        {/* Calendar Grid */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Progress Calendar
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Click on a day to mark it as completed or failed
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ChallengeCalendar
              days={selectedChallenge.days}
              onDayClick={handleDayClick}
            />
          </Box>
        </Paper>

        {/* Day Marking Form */}
        {selectedDay && (
          <Paper sx={{ p: 2 }}>
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
          </Paper>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
          {dayjs(selectedChallenge.startDate).format('MMM D')} - {dayjs(selectedChallenge.endDate).format('MMM D, YYYY')}
        </Typography>
      </Box>
    );
  }

  // List view
  return (
    <Box sx={{ width: '100%', maxWidth: 600 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Challenges
          </Typography>
        </Box>
        <Button
          startIcon={<Add />}
          variant="contained"
          size="small"
          onClick={() => setCreateDialogOpen(true)}
        >
          New Challenge
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Active (${activeCount})`} />
        <Tab label={`Completed (${completedCount})`} />
        <Tab label="All" />
      </Tabs>

      {/* Content */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">Loading challenges...</Typography>
        </Box>
      ) : filteredChallenges.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {tab === 0
            ? 'No active challenges. Create one to get started!'
            : 'No challenges found.'}
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredChallenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onClick={() => setSelectedChallenge(challenge)}
              onMenuClick={(e) => {
                setMenuAnchor(e.currentTarget as HTMLElement);
                setMenuChallenge(challenge);
              }}
            />
          ))}
        </Box>
      )}

      <CreateChallengeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateChallenge}
      />

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleDeleteChallenge} sx={{ color: 'error.main' }}>
          Delete Challenge
        </MenuItem>
      </Menu>
    </Box>
  );
};
