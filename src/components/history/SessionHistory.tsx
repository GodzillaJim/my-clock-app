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
  Tabs,
  Tab,
} from '@mui/material';
import { StatsOverview } from './StatsOverview';
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
  SessionPlan,
  SessionPlanSegment,
  formatTime,
  formatDurationFromSeconds,
  AppSettings
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import dayjs from 'dayjs';
import { LinearProgress } from '@mui/material';

interface SessionHistoryProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onResumePlan?: (plan: SessionPlan) => void;
}

/** A plan can be resumed if it stopped short and still has segments left to run. */
const isPlanResumable = (plan: SessionPlan): boolean => {
  if (plan.status === 'completed') return false;
  return plan.segments.some(
    s => s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted'
  );
};

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  open,
  onClose,
  settings,
  onResumePlan
}) => {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [history, setHistory] = useState<DailyHistory | null>(null);
  const [plans, setPlans] = useState<SessionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
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
      const [historyData, plansData] = await Promise.all([
        focusStorage.getHistoryByDate(date),
        focusStorage.getPlansForDate(date),
      ]);
      setHistory(historyData);
      setPlans(plansData);
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
      <Box sx={{ mb: 3 }}>
        {/* Day start/end times */}
        {(history.dayStartTime || history.dayEndTime) && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2, justifyContent: 'center' }}>
            {history.dayStartTime && (
              <Typography variant="body2" color="text.secondary">
                Started: {formatTime(new Date(history.dayStartTime), settings.timeFormat)}
              </Typography>
            )}
            {history.dayStartTime && history.dayEndTime && (
              <Typography variant="body2" color="text.secondary">|</Typography>
            )}
            {history.dayEndTime && (
              <Typography variant="body2" color="text.secondary">
                Ended: {formatTime(new Date(history.dayEndTime), settings.timeFormat)}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{
          display: 'flex',
          gap: 3,
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
      </Box>
    );
  };

  const getSegmentStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' | 'info' => {
    switch (status) {
      case 'completed': return 'success';
      case 'interrupted': return 'error';
      case 'skipped': return 'warning';
      case 'in_progress': return 'info';
      default: return 'default';
    }
  };

  const renderPlanTimeline = () => {
    if (plans.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Session Plans
          <Chip label={plans.length} size="small" variant="outlined" />
        </Typography>

        {plans.map((plan, planIdx) => {
          const completedSegs = plan.segments.filter(s => s.status === 'completed').length;
          const progress = plan.segments.length > 0
            ? (completedSegs / plan.segments.length) * 100
            : 0;
          const startedAt = new Date(plan.createdAt);
          const endedAt = plan.actualEndTime ? new Date(plan.actualEndTime) : null;

          return (
            <Box
              key={plan.id}
              sx={{
                mb: 2,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {/* Plan header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2">
                    Plan {planIdx + 1}
                  </Typography>
                  <Chip
                    label={plan.status}
                    size="small"
                    color={
                      plan.status === 'completed' ? 'success' :
                      plan.status === 'interrupted' ? 'error' :
                      plan.status === 'abandoned' ? 'warning' : 'info'
                    }
                    variant="filled"
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(startedAt, settings.timeFormat)}
                    {endedAt && <> — {formatTime(endedAt, settings.timeFormat)}</>}
                  </Typography>
                  {onResumePlan && isPlanResumable(plan) && (
                    <Tooltip title="Resume the remaining segments of this session">
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<PlayCircle />}
                        onClick={() => onResumePlan(plan)}
                        sx={{ py: 0.25 }}
                      >
                        Resume
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Progress bar */}
              <Box sx={{ mb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 4, borderRadius: 2 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {completedSegs}/{plan.segments.length} segments
                  {' | '}
                  {formatDurationFromSeconds(plan.totalElapsed)} elapsed
                  {' of '}
                  {formatDurationFromSeconds(plan.totalPlannedDuration)} planned
                </Typography>
              </Box>

              {/* Segment chips */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {plan.segments.map((seg) => (
                  <Tooltip
                    key={seg.id}
                    title={
                      <Box>
                        <div>{seg.type === SessionType.FOCUS ? 'Focus' : 'Break'} — {seg.status}</div>
                        <div>Planned: {Math.round(seg.plannedDuration / 60)}m</div>
                        {seg.actualDuration !== null && (
                          <div>Actual: {Math.round(seg.actualDuration / 60)}m</div>
                        )}
                        {seg.actualStartTime && (
                          <div>Started: {formatTime(new Date(seg.actualStartTime), settings.timeFormat)}</div>
                        )}
                        {seg.actualEndTime && (
                          <div>Ended: {formatTime(new Date(seg.actualEndTime), settings.timeFormat)}</div>
                        )}
                      </Box>
                    }
                  >
                    <Chip
                      label={`${seg.type === SessionType.FOCUS ? 'F' : 'B'} ${Math.round(seg.plannedDuration / 60)}m`}
                      size="small"
                      color={getSegmentStatusColor(seg.status)}
                      variant={seg.status === 'pending' ? 'outlined' : 'filled'}
                      sx={{ minWidth: 50 }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          );
        })}
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0 }}>
          <Timeline />
          Session History
        </DialogTitle>

        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="History" />
          <Tab label="Stats" />
        </Tabs>

        <DialogContent>
          {activeTab === 0 && (
            <>
              {loading && availableDates.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography>Loading history...</Typography>
                </Box>
              ) : (
                <>
                  {renderDateNavigation()}
                  <Divider sx={{ mb: 3 }} />
                  {renderDaySummary()}
                  {renderPlanTimeline()}
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
            </>
          )}
          {activeTab === 1 && <StatsOverview />}
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
