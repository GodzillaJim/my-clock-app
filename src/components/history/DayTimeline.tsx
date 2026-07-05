import React, { useMemo } from 'react';
import { Box, Typography, Button, Tooltip, Chip } from '@mui/material';
import { PlayCircle, WarningAmber } from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  SessionPlan,
  SessionPlanSegment,
  SessionType,
  AppSettings,
  formatTime,
  formatDurationFromSeconds,
} from '@/features/timer/types';

interface DayTimelineProps {
  dateLabel: string;
  plans: SessionPlan[];
  settings: AppSettings;
  onResumePlan?: (plan: SessionPlan) => void;
}

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace';
const HOUR = 60 * 60 * 1000;

const isResumable = (plan: SessionPlan): boolean =>
  plan.status !== 'completed' &&
  plan.segments.some(s => s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted');

const segStart = (s: SessionPlanSegment): number | null =>
  s.actualStartTime ?? (s.status !== 'pending' ? s.expectedStartTime : null);

const segEnd = (s: SessionPlanSegment): number | null => {
  if (s.actualEndTime) return s.actualEndTime;
  if (s.actualStartTime) return s.actualStartTime + (s.actualDuration ?? s.plannedDuration) * 1000;
  return s.status !== 'pending' ? s.expectedEndTime : null;
};

interface Block {
  key: string;
  start: number;
  end: number;
  type: SessionType;
  status: string;
  planIdx: number;
}

export const DayTimeline: React.FC<DayTimelineProps> = ({ dateLabel, plans, settings, onResumePlan }) => {
  const theme = useTheme();

  const { blocks, axisStart, axisEnd, ticks } = useMemo(() => {
    const bl: Block[] = [];
    plans.forEach((plan, planIdx) => {
      plan.segments.forEach((seg) => {
        if (seg.status === 'pending') return;
        const s = segStart(seg);
        const e = segEnd(seg);
        if (s == null || e == null || e <= s) return;
        bl.push({ key: seg.id, start: s, end: e, type: seg.type, status: seg.status, planIdx });
      });
    });

    if (bl.length === 0) {
      return { blocks: bl, axisStart: 0, axisEnd: 0, ticks: [] as number[] };
    }

    const minStart = Math.min(...bl.map(b => b.start));
    const maxEnd = Math.max(...bl.map(b => b.end));
    let aStart = Math.floor(minStart / HOUR) * HOUR;
    let aEnd = Math.ceil(maxEnd / HOUR) * HOUR;
    if (aEnd - aStart < HOUR) aEnd = aStart + HOUR;

    const span = aEnd - aStart;
    const stepHours = span > 8 * HOUR ? 2 : 1;
    const tk: number[] = [];
    for (let t = aStart; t <= aEnd; t += stepHours * HOUR) tk.push(t);

    return { blocks: bl, axisStart: aStart, axisEnd: aEnd, ticks: tk };
  }, [plans]);

  const summary = useMemo(() => {
    let firstStart: number | null = null;
    let lastEnd: number | null = null;
    let focusSeconds = 0;
    let totalSegs = 0;
    let doneSegs = 0;

    plans.forEach((plan) => {
      plan.segments.forEach((seg) => {
        totalSegs += 1;
        if (seg.status === 'completed' || seg.status === 'skipped' || seg.status === 'interrupted') doneSegs += 1;
        if (seg.type === SessionType.FOCUS && (seg.status === 'completed' || seg.status === 'interrupted')) {
          focusSeconds += seg.actualDuration || 0;
        }
        const s = seg.actualStartTime;
        const e = seg.actualEndTime;
        if (s && (firstStart == null || s < firstStart)) firstStart = s;
        if (e && (lastEnd == null || e > lastEnd)) lastEnd = e;
      });
    });

    return { firstStart, lastEnd, focusSeconds, totalSegs, doneSegs };
  }, [plans]);

  const blockColor = (b: Block): string => {
    if (b.status === 'interrupted') return theme.palette.error.main;
    if (b.status === 'skipped') return alpha(theme.palette.warning.main, 0.55);
    const base = b.type === SessionType.FOCUS ? theme.palette.primary.main : theme.palette.secondary.main;
    return b.type === SessionType.FOCUS ? base : alpha(base, 0.55);
  };

  const resumablePlans = plans.filter(isResumable);
  const span = axisEnd - axisStart;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{dateLabel}</Typography>
        {summary.firstStart != null && summary.lastEnd != null && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: MONO }}>
            {formatTime(new Date(summary.firstStart), settings.timeFormat)}
            {'  →  '}
            {formatTime(new Date(summary.lastEnd), settings.timeFormat)}
          </Typography>
        )}
      </Box>

      {/* Summary facts */}
      {summary.totalSegs > 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 700, fontFamily: MONO }}>
            {formatDurationFromSeconds(summary.focusSeconds)}
          </Box>{' '}focus
          <Box component="span" sx={{ mx: 1, opacity: 0.4 }}>·</Box>
          {summary.doneSegs}/{summary.totalSegs} segments
        </Typography>
      ) : null}

      {/* Timeline track */}
      {blocks.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              position: 'relative',
              height: 60,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.03),
              overflow: 'hidden',
            }}
          >
            {blocks.map((b) => {
              const left = ((b.start - axisStart) / span) * 100;
              const width = Math.max(((b.end - b.start) / span) * 100, 1.2);
              const isFocus = b.type === SessionType.FOCUS;
              return (
                <Tooltip
                  key={b.key}
                  arrow
                  title={
                    <Box sx={{ py: 0.25 }}>
                      <div style={{ fontWeight: 600 }}>
                        {isFocus ? 'Focus' : 'Break'} · {b.status}
                      </div>
                      <div>
                        {formatTime(new Date(b.start), settings.timeFormat)} –{' '}
                        {formatTime(new Date(b.end), settings.timeFormat)}
                      </div>
                      <div>{formatDurationFromSeconds(Math.round((b.end - b.start) / 1000))}</div>
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: isFocus ? 6 : 18,
                      bottom: isFocus ? 6 : 18,
                      borderRadius: 0.75,
                      backgroundColor: blockColor(b),
                      cursor: 'default',
                      transition: 'filter 120ms',
                      '&:hover': { filter: 'brightness(1.15)' },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>

          {/* Hour ticks */}
          <Box sx={{ position: 'relative', height: 16, mt: 0.5 }}>
            {ticks.map((t) => {
              const left = ((t - axisStart) / span) * 100;
              return (
                <Typography
                  key={t}
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    left: `${left}%`,
                    transform: 'translateX(-50%)',
                    color: 'text.secondary',
                    fontSize: '0.62rem',
                    fontFamily: MONO,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatTime(new Date(t), settings.timeFormat)}
                </Typography>
              );
            })}
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
          No sessions recorded on this day.
        </Typography>
      )}

      {/* Unfinished sessions: the only actionable list, not a re-listing of everything */}
      {resumablePlans.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {resumablePlans.map((plan) => {
            const done = plan.segments.filter(s => s.status === 'completed').length;
            const startedAt = plan.segments.find(s => s.actualStartTime)?.actualStartTime ?? plan.createdAt;
            return (
              <Box
                key={plan.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  py: 1.25,
                  px: 1.5,
                  borderRadius: 1.5,
                  border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  mb: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                  <WarningAmber sx={{ color: 'error.main', fontSize: 20 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Unfinished session
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: MONO }}>
                      started {formatTime(new Date(startedAt), settings.timeFormat)} · {done}/{plan.segments.length} done
                    </Typography>
                  </Box>
                  <Chip
                    label={plan.status}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 0.5, height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                {onResumePlan && (
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<PlayCircle />}
                    onClick={() => onResumePlan(plan)}
                    sx={{ flexShrink: 0 }}
                  >
                    Resume
                  </Button>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
