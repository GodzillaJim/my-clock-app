import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Add,
  EmojiEvents,
  Close,
} from '@mui/icons-material';
import { Challenge, ChallengeStatus } from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { ChallengeCard } from './ChallengeCard';
import { CreateChallengeDialog } from './CreateChallengeDialog';
import { ChallengeDetailDialog } from './ChallengeDetailDialog';

interface ChallengeListProps {
  open: boolean;
  onClose: () => void;
}

export const ChallengeList: React.FC<ChallengeListProps> = ({ open, onClose }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuChallenge, setMenuChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    if (open) {
      loadChallenges();
    }
  }, [open]);

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
    await loadChallenges();
  };

  const handleChallengeUpdate = async () => {
    await loadChallenges();
    if (selectedChallenge) {
      const updated = await focusStorage.getChallengeById(selectedChallenge.id);
      if (updated) {
        setSelectedChallenge(updated);
      }
    }
  };

  const activeCount = challenges.filter(c => c.status === ChallengeStatus.ACTIVE).length;
  const completedCount = challenges.filter(c =>
    c.status === ChallengeStatus.COMPLETED || c.status === ChallengeStatus.FAILED
  ).length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEvents color="primary" />
              <Typography variant="h6">Challenges</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<Add />}
                variant="contained"
                size="small"
                onClick={() => setCreateDialogOpen(true)}
              >
                New Challenge
              </Button>
              <IconButton onClick={onClose} size="small">
                <Close />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label={`Active (${activeCount})`} />
            <Tab label={`Completed (${completedCount})`} />
            <Tab label="All" />
          </Tabs>

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
        </DialogContent>
      </Dialog>

      <CreateChallengeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateChallenge}
      />

      {selectedChallenge && (
        <ChallengeDetailDialog
          open={!!selectedChallenge}
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onUpdate={handleChallengeUpdate}
        />
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleDeleteChallenge} sx={{ color: 'error.main' }}>
          Delete Challenge
        </MenuItem>
      </Menu>
    </>
  );
};
