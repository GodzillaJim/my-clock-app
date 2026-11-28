import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  LifetimeStats,
  SessionPlan,
  SessionPlanSegment,
  SegmentStatus,
  CompletionStatus,
  AppSettings,
  getTodayDateString,
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { MomentumHeader } from './MomentumHeader';
import { FocusHeatmap } from './FocusHeatmap';
import { DayTimeline } from './DayTimeline';
import { RhythmTrends } from './RhythmTrends';

interface HistoryViewProps {
  settings: AppSettings;
  onClose: () => void;
  onResumePlan?: (plan: SessionPlan) => void;
}

const HEATMAP_WEEKS = 12;
const dateKey = (d: Date): string => d.toISOString().split('T')[0];

const formatDayLabel = (dateStr: string): string => {
  const today = getTodayDateString();
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
};

// Older days may predate plan tracking. Rebuild a display-only plan from the
// day's session records so the timeline still has something to show.
const synthesizePlanFromSessions = (date: string, history: Awaited<ReturnType<typeof focusStorage.getHistoryByDate>>): SessionPlan[] => {
  if (!history?.sessions || history.sessions.length === 0) return [];
  const segments: SessionPlanSegment[] = history.sessions.map((s, i) => {
    const start = new Date(s.startTime).getTime();
    const end = s.endTime ? new Date(s.endTime).getTime() : start + s.actualDuration * 1000;
    const status: SegmentStatus =
      s.completionStatus === CompletionStatus.COMPLETED ? 'completed' :
      s.completionStatus === CompletionStatus.INTERRUPTED ? 'interrupted' : 'skipped';
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
  return [{
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
  }];
};

export const HistoryView: React.FC<HistoryViewProps> = ({ settings, onClose, onResumePlan }) => {
  const theme = useTheme();
  const todayKey = getTodayDateString();

  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [focusByDate, setFocusByDate] = useState<Map<string, number>>(new Map());
  const [series, setSeries] = useState<{ date: string; seconds: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [dayPlans, setDayPlans] = useState<SessionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const lifetime = await focusStorage.recalculateLifetimeStats();

      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - (HEATMAP_WEEKS * 7 - 1));
      const histories = await focusStorage.getHistoryForPeriod(dateKey(start), dateKey(today));

      const map = new Map<string, number>();
      histories.forEach(h => map.set(h.date, h.totalFocusTime || 0));

      const daily: { date: string; seconds: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = dateKey(d);
        daily.push({ date: k, seconds: map.get(k) || 0 });
      }

      setStats(lifetime);
      setFocusByDate(map);
      setSeries(daily);
    } catch (err) {
      console.error('Failed to load history overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDay = async (date: string) => {
    try {
      const plans = await focusStorage.getPlansForDate(date);
      if (plans.length > 0) {
        setDayPlans(plans);
        return;
      }
      const history = await focusStorage.getHistoryByDate(date);
      setDayPlans(synthesizePlanFromSessions(date, history));
    } catch (err) {
      console.error('Failed to load day:', err);
      setDayPlans([]);
    }
  };

  const todayFocusSeconds = focusByDate.get(todayKey) || 0;
  const hasAnyData = useMemo(
    () => (stats?.totalSessions ?? 0) > 0 || focusByDate.size > 0,
    [stats, focusByDate]
  );

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
      <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2.5, md: 5 }, py: { xs: 3, md: 5 } }}>
        {loading || !stats ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">Gathering your history…</Typography>
          </Box>
        ) : (
          <>
            <MomentumHeader
              todayFocusSeconds={todayFocusSeconds}
              streakDays={stats.currentDayStreak}
              avgDailyFocusSeconds={stats.averageDailyFocusTime}
              onClose={onClose}
            />

            {!hasAnyData ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="h6" gutterBottom>No focus history yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Finish your first session and it will start filling in here.
                </Typography>
              </Box>
            ) : (
              <>
                {/* Heatmap centerpiece */}
                <Box sx={{ mt: 5, mb: 2 }}>
                  <Typography variant="overline" sx={{ letterSpacing: '0.14em', color: 'text.secondary' }}>
                    Last 12 weeks
                  </Typography>
                </Box>
                <Box sx={{ mb: 5, overflowX: 'auto' }}>
                  <FocusHeatmap
                    focusByDate={focusByDate}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    weeks={HEATMAP_WEEKS}
                  />
                </Box>

                {/* Detail + trends */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' },
                    gap: { xs: 4, md: 5 },
                    alignItems: 'start',
                  }}
                >
                  <Box sx={{ pr: { md: 4 }, borderRight: { md: `1px solid ${theme.palette.divider}` } }}>
                    <DayTimeline
                      dateLabel={formatDayLabel(selectedDate)}
                      plans={dayPlans}
                      settings={settings}
                      onResumePlan={onResumePlan}
                    />
                  </Box>
                  <RhythmTrends stats={stats} series={series} />
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
