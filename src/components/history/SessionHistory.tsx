import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert
} from '@mui/material';
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  SkipNext,
  Coffee,
  LocalCafe,
  Download,
  Delete,
  Timeline
} from '@mui/icons-material';
import {
  SessionRecord,
  SessionType,
  CompletionStatus,
  SessionStats,
  DailyHistory,
  formatTime,
  formatDuration,
  AppSettings
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';

interface SessionHistoryProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  open,
  onClose,
  settings
}) => {
  const [history, setHistory] = useState<DailyHistory | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [todayHistory, sessionStats] = await Promise.all([
        focusStorage.getTodayHistory(),
        focusStorage.getSessionStats()
      ]);
      setHistory(todayHistory);
      setStats(sessionStats);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await focusStorage.clearTodayHistory();
      await loadHistory();
      setClearDialogOpen(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleExport = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const exportData = await focusStorage.exportHistory(today, today, settings.exportFormat);
      
      const blob = new Blob([exportData], { 
        type: settings.exportFormat === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `focus-sessions-${today}.${settings.exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export history:', error);
    }
  };

  const getSessionIcon = (session: SessionRecord) => {
    if (session.type === SessionType.FOCUS) {
      return <PlayCircle color="primary" />;
    } else if (session.type === SessionType.SHORT_BREAK) {
      return <Coffee color="secondary" />;
    } else {
      return <LocalCafe color="success" />;
    }
  };

  const getStatusIcon = (status: CompletionStatus) => {
    switch (status) {
      case CompletionStatus.COMPLETED:
        return <PlayCircle color="success" fontSize="small" />;
      case CompletionStatus.INTERRUPTED:
        return <StopCircle color="error" fontSize="small" />;
      case CompletionStatus.SKIPPED:
        return <SkipNext color="warning" fontSize="small" />;
      default:
        return <PauseCircle color="disabled" fontSize="small" />;
    }
  };

  const getStatusColor = (status: CompletionStatus): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case CompletionStatus.COMPLETED:
        return 'success';
      case CompletionStatus.INTERRUPTED:
        return 'error';
      case CompletionStatus.SKIPPED:
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: CompletionStatus): string => {
    switch (status) {
      case CompletionStatus.COMPLETED:
        return 'Completed';
      case CompletionStatus.INTERRUPTED:
        return 'Stopped';
      case CompletionStatus.SKIPPED:
        return 'Skipped';
      default:
        return 'Unknown';
    }
  };

  const renderStatsCards = () => {
    if (!stats) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="primary">
                {stats.completedSessions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed Sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="success.main">
                {stats.totalFocusTime}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Focus Time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="warning.main">
                {stats.currentStreak}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Streak
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="info.main">
                {stats.averageSessionTime}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Session
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderSessionTimeline = () => {
    if (!history || history.sessions.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No sessions recorded today. Start your first focus session to see your history here!
        </Alert>
      );
    }

    const sortedSessions = [...history.sessions].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return (
      <List>
        {sortedSessions.map((session, index) => (
          <React.Fragment key={session.id}>
            <ListItem>
              <ListItemIcon>
                {getSessionIcon(session)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {session.type === SessionType.FOCUS 
                        ? `Focus Session #${session.sessionNumber}` 
                        : session.type === SessionType.SHORT_BREAK 
                          ? 'Short Break' 
                          : 'Long Break'
                      }
                    </Typography>
                    <Chip 
                      icon={getStatusIcon(session.completionStatus)}
                      label={getStatusLabel(session.completionStatus)}
                      size="small"
                      color={getStatusColor(session.completionStatus)}
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {formatTime(new Date(session.startTime), settings.timeFormat)} - {' '}
                      {session.endTime 
                        ? formatTime(new Date(session.endTime), settings.timeFormat)
                        : 'In Progress'
                      }
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Duration: {formatDuration(session.actualDuration)} 
                      {session.actualDuration !== session.plannedDuration && (
                        <span style={{ color: '#666' }}>
                          {' '}(planned: {formatDuration(session.plannedDuration)})
                        </span>
                      )}
                    </Typography>
                    {session.pausedTime > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Paused time: {Math.round(session.pausedTime / (1000 * 60))}m
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
            {index < sortedSessions.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  const renderActions = () => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
      <Box>
        <Tooltip title="Export today's history">
          <IconButton onClick={handleExport} color="primary">
            <Download />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear today's history">
          <IconButton 
            onClick={() => setClearDialogOpen(true)} 
            color="error"
            disabled={!history || history.sessions.length === 0}
          >
            <Delete />
          </IconButton>
        </Tooltip>
      </Box>
      <Button onClick={onClose}>
        Close
      </Button>
    </Box>
  );

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline />
          Today's Session History
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {history?.date}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>Loading history...</Typography>
            </Box>
          ) : (
            <>
              {renderStatsCards()}
              <Typography variant="h6" gutterBottom>
                Session Timeline
              </Typography>
              {renderSessionTimeline()}
            </>
          )}
        </DialogContent>
        
        <DialogActions>
          {renderActions()}
        </DialogActions>
      </Dialog>

      <Dialog 
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
      >
        <DialogTitle>Clear Today's History</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to clear all of today's session history? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleClearHistory} color="error">
            Clear History
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};