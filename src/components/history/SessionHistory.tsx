import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  Select,
  MenuItem,
  FormControl,
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
  Timeline,
  Refresh,
  ChevronLeft,
  ChevronRight,
  CalendarToday,
} from '@mui/icons-material';
import {
  SessionRecord,
  SessionType,
  CompletionStatus,
  DailyHistory,
  formatTime,
  formatDurationFromSeconds,
  AppSettings
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import dayjs from 'dayjs';

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
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [history, setHistory] = useState<DailyHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableDates();
    }
  }, [open]);

  useEffect(() => {
    if (selectedDate) {
      loadHistoryForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadAvailableDates = async () => {
    try {
      setLoading(true);
      const dates = await focusStorage.getAllHistoryDates();
      const today = dayjs().format('YYYY-MM-DD');

      // Always include today in the list, even if no sessions yet
      if (!dates.includes(today)) {
        dates.unshift(today);
      }

      setAvailableDates(dates);
      // Select today by default, or the most recent date
      setSelectedDate(today);
    } catch (error) {
      console.error('Failed to load available dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryForDate = async (date: string) => {
    try {
      setLoading(true);
      const historyData = await focusStorage.getHistoryByDate(date);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handlePreviousDay = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex < availableDates.length - 1) {
      setSelectedDate(availableDates[currentIndex + 1]);
    }
  };

  const handleNextDay = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex > 0) {
      setSelectedDate(availableDates[currentIndex - 1]);
    }
  };

  const handleClearHistory = async () => {
    try {
      await focusStorage.clearTodayHistory();
      await loadAvailableDates();
      setClearDialogOpen(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleResetHistory = async () => {
    try {
      await focusStorage.resetAllHistory();
      await loadAvailableDates();
      setResetDialogOpen(false);
    } catch (error) {
      console.error('Failed to reset all history:', error);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = await focusStorage.exportHistory(selectedDate, selectedDate, settings.exportFormat);

      const blob = new Blob([exportData], {
        type: settings.exportFormat === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `focus-sessions-${selectedDate}.${settings.exportFormat}`;
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

  const formatDateDisplay = (dateStr: string) => {
    const date = dayjs(dateStr);
    const today = dayjs();
    const yesterday = today.subtract(1, 'day');

    if (date.isSame(today, 'day')) {
      return 'Today';
    } else if (date.isSame(yesterday, 'day')) {
      return 'Yesterday';
    } else {
      return date.format('ddd, MMM D, YYYY');
    }
  };

  const renderDateNavigation = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    const hasPrevious = currentIndex < availableDates.length - 1;
    const hasNext = currentIndex > 0;

    return (
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
        gap: 2,
      }}>
        <IconButton
          onClick={handlePreviousDay}
          disabled={!hasPrevious}
          size="small"
        >
          <ChevronLeft />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
          <CalendarToday sx={{ color: 'text.secondary' }} />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
            >
              {availableDates.map((date) => (
                <MenuItem key={date} value={date}>
                  {formatDateDisplay(date)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <IconButton
          onClick={handleNextDay}
          disabled={!hasNext}
          size="small"
        >
          <ChevronRight />
        </IconButton>
      </Box>
    );
  };

  const renderDaySummary = () => {
    if (!history) return null;

    const focusMinutes = Math.round(history.totalFocusTime / 60);
    const breakMinutes = Math.round(history.totalBreakTime / 60);

    return (
      <Box sx={{
        display: 'flex',
        gap: 3,
        mb: 3,
        flexWrap: 'wrap',
      }}>
        <Box sx={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
          <Typography variant="h4" color="primary.main" fontWeight={600}>
            {Math.floor(focusMinutes / 60)}h {focusMinutes % 60}m
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Focus Time
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
          <Typography variant="h4" color="secondary.main" fontWeight={600}>
            {breakMinutes}m
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Break Time
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
          <Typography variant="h4" color="success.main" fontWeight={600}>
            {history.completedSessions}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Completed
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
          <Typography variant="h4" color="text.secondary" fontWeight={600}>
            {history.sessions?.length || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total Sessions
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderSessionTimeline = () => {
    if (!history || !history.sessions || history.sessions.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No sessions recorded for {formatDateDisplay(selectedDate)}.
          {selectedDate === dayjs().format('YYYY-MM-DD') && (
            <> Start your first focus session to see your history here!</>
          )}
        </Alert>
      );
    }

    const sortedSessions = [...history.sessions].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    return (
      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
        {sortedSessions.map((session, index) => (
          <React.Fragment key={session.id}>
            <ListItem sx={{ py: 1.5 }}>
              <ListItemIcon>
                {getSessionIcon(session)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {session.type === SessionType.FOCUS
                        ? `Focus Session`
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
                      Duration: {formatDurationFromSeconds(session.actualDuration)}
                      {session.actualDuration !== session.plannedDuration && (
                        <span style={{ opacity: 0.7 }}>
                          {' '}(planned: {formatDurationFromSeconds(session.plannedDuration)})
                        </span>
                      )}
                    </Typography>
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

  const renderActions = () => {
    const isToday = selectedDate === dayjs().format('YYYY-MM-DD');

    return (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Box>
          <Tooltip title="Export this day's history">
            <IconButton
              onClick={handleExport}
              color="primary"
              disabled={!history || !history.sessions || history.sessions.length === 0}
            >
              <Download />
            </IconButton>
          </Tooltip>
          {isToday && (
            <Tooltip title="Clear today's history">
              <IconButton
                onClick={() => setClearDialogOpen(true)}
                color="error"
                disabled={!history || !history.sessions || history.sessions.length === 0}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Reset all history">
            <IconButton
              onClick={() => setResetDialogOpen(true)}
              color="warning"
            >
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
        <Button onClick={onClose}>
          Close
        </Button>
      </Box>
    );
  };

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
          Session History
        </DialogTitle>

        <DialogContent>
          {loading && availableDates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>Loading history...</Typography>
            </Box>
          ) : (
            <>
              {renderDateNavigation()}
              <Divider sx={{ mb: 3 }} />
              {renderDaySummary()}
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Sessions
                {history?.sessions && (
                  <Chip
                    label={history.sessions.length}
                    size="small"
                    variant="outlined"
                  />
                )}
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

      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
      >
        <DialogTitle>Reset All History</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reset all of your session history?
            This action will permanently delete all data and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleResetHistory} color="error">
            Reset History
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
