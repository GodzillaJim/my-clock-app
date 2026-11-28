import React, { useState, useEffect } from 'react';
import { Box, Button, IconButton, Skeleton, Tooltip, Typography, useTheme } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import {
  LifetimeStats,
  SessionPlan,
  SessionPlanSegment,
  SegmentStatus,
  CompletionStatus,
  AppSettings,
  getTodayDateString,
  DailyHistory,
} from '@/features/timer/types';
import { datesUpTo } from '@/features/stats/stats';
import { todaySummary } from '@/features/stats/historyCopy';
import { services } from '@/services/domain';
import { FocusHeatmap } from './FocusHeatmap';
import { DayTimeline } from './DayTimeline';
import { RhythmTrends } from './RhythmTrends';
import { createLogger } from '@/services/logger';

const log = createLogger('HistoryView');

interface HistoryViewProps {
  settings: AppSettings;
  onClose: () => void;
  onResumePlan?: (plan: SessionPlan) => void;
}

const HEATMAP_WEEKS = 12;

/** "Today", "Yesterday", or "Monday, November 23" for a store date. */
const dayLabel = (date: string, today: string): string => {
  if (date === today) return 'Today';
  if (date === datesUpTo(today, 2)[0]) return 'Yesterday';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

// Older days may predate plan tracking. Rebuild a display-only plan from the
// day's session records so the timeline still has something to show.
const synthesizePlanFromSessions = (date: string, history: DailyHistory | null): SessionPlan[] => {
  if (!history?.sessions || history.sessions.length === 0) return [];
  const segments: SessionPlanSegment[] = history.sessions.map((s, i) => {
    const start = new Date(s.startTime).getTime();
    const end = s.endTime ? new Date(s.endTime).getTime() : start + s.actualDuration * 1000;
    const status: SegmentStatus =
      s.completionStatus === CompletionStatus.COMPLETED
        ? 'completed'
        : s.completionStatus === CompletionStatus.INTERRUPTED
          ? 'interrupted'
          : 'skipped';
    return {
      id: s.id,
      index: i,
      type: s.type,
      plannedDuration: s.plannedDuration,
      actualDuration: s.actualDuration,
      expectedStartTime: start,
      expectedEndTime: end,
      actualStartTime: start,
      actualEndTime: end,
      status,
      pausedTime: 0,
      elapsedAtLastUpdate: s.actualDuration,
    };
  });
  return [
    {
      id: `legacy-${date}`,
      createdAt: segments[0]?.actualStartTime ?? Date.now(),
      status: 'completed', // keeps legacy days non-resumable
      segments,
      currentSegmentIndex: -1,
      settings: { focusDuration: 0, shortBreakDuration: 0 },
      expectedEndTime: segments[segments.length - 1]?.actualEndTime ?? Date.now(),
      actualEndTime: segments[segments.length - 1]?.actualEndTime ?? null,
      interruptedAt: null,
      totalPlannedDuration: segments.reduce((sum, s) => sum + s.plannedDuration, 0),
      totalElapsed: segments.reduce((sum, s) => sum + (s.actualDuration || 0), 0),
      lastUpdated: Date.now(),
    },
  ];
};

/** Placeholder in the shape of the page while the history loads. */
const HistorySkeleton: React.FC = () => (
  <Box aria-busy="true" aria-label="Loading your history">
    <Skeleton variant="text" sx={{ fontSize: '1.375rem', maxWidth: 560 }} />
    <Skeleton variant="rounded" height={150} sx={{ mt: 5, maxWidth: 260 }} />
    <Box
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' }, gap: 5, mt: 5 }}
    >
      <Skeleton variant="rounded" height={120} />
      <Skeleton variant="rounded" height={220} />
    </Box>
  </Box>
);

/** Your focus over time: a sentence about today, twelve weeks of days, and one day in detail. */
export const HistoryView: React.FC<HistoryViewProps> = ({ settings, onClose, onResumePlan }) => {
  const theme = useTheme();
  const today = getTodayDateString();

  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [focusByDate, setFocusByDate] = useState<Map<string, number>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dayPlans, setDayPlans] = useState<SessionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const lifetime = await services.stats.recalculate();
        const range = datesUpTo(today, HEATMAP_WEEKS * 7);
        const histories = await services.history.forPeriod(range[0], today);
        setFocusByDate(new Map(histories.map((h) => [h.date, h.totalFocusTime || 0])));
        setStats(lifetime);
      } catch (err) {
        log.error('Failed to load history overview:', err);
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, [today]);

  useEffect(() => {
    const loadDay = async () => {
      try {
        const plans = await services.plans.forDate(selectedDate);
        if (plans.length > 0) return setDayPlans(plans);
        const history = await services.history.byDate(selectedDate);
        setDayPlans(synthesizePlanFromSessions(selectedDate, history));
      } catch (err) {
        log.error('Failed to load day:', err);
        setDayPlans([]);
      }
    };
    loadDay();
  }, [selectedDate]);

  const series = datesUpTo(today, 30).map((date) => ({
    date,
    seconds: focusByDate.get(date) ?? 0,
  }));
  const hasAnyData = (stats?.totalSessions ?? 0) > 0 || focusByDate.size > 0;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.modal,
        backgroundColor: 'background.default',
        overflowY: 'auto',
      }}
    >
      <Box
        component="main"
        sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 3, md: 6 }, py: { xs: 3, md: 5 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, ml: -1 }}>
          <Tooltip title="Back (Esc)">
            <IconButton aria-label="Back" onClick={onClose}>
              <ArrowBack />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" component="h1">
            History
          </Typography>
        </Box>

        {loading || !stats ? (
          <HistorySkeleton />
        ) : !hasAnyData ? (
          <Box sx={{ py: 8, maxWidth: 520 }}>
            <Typography variant="h6" component="p" gutterBottom>
              Nothing here yet.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Each focus session you finish is added here, so you can see your days and weeks take
              shape.
            </Typography>
            <Button variant="contained" onClick={onClose}>
              Back to the timer
            </Button>
          </Box>
        ) : (
          <>
            <Typography
              sx={{ fontSize: '1.375rem', lineHeight: 1.45, maxWidth: '38ch', textWrap: 'pretty' }}
            >
              {todaySummary(
                focusByDate.get(today) ?? 0,
                stats.averageDailyFocusTime,
                stats.currentDayStreak,
              )}
            </Typography>

            <Box component="section" aria-labelledby="weeks-heading" sx={{ mt: 5, mb: 6 }}>
              <Typography id="weeks-heading" variant="h6" component="h2" sx={{ mb: 1.5 }}>
                Last 12 weeks
              </Typography>
              <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
                <FocusHeatmap
                  focusByDate={focusByDate}
                  today={today}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  weeks={HEATMAP_WEEKS}
                />
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' },
                gap: { xs: 5, md: 7 },
                alignItems: 'start',
              }}
            >
              <DayTimeline
                dateLabel={dayLabel(selectedDate, today)}
                plans={dayPlans}
                settings={settings}
                onResumePlan={onResumePlan}
              />
              <RhythmTrends stats={stats} series={series} timeFormat={settings.timeFormat} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};
