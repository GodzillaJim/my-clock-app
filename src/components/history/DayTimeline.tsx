import React, { useMemo } from 'react';
import { Box, Typography, Button, Tooltip, useTheme, alpha } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import {
  SessionPlan,
  SessionPlanSegment,
  SessionType,
  AppSettings,
  formatTime,
} from '@/features/timer/types';
import { daySummary, formatSpan } from '@/features/stats/historyCopy';
import { radius } from '@/theme/tokens';

interface DayTimelineProps {
  dateLabel: string;
  plans: SessionPlan[];
  settings: AppSettings;
  onResumePlan?: (plan: SessionPlan) => void;
}

const HOUR = 60 * 60 * 1000;

const isResumable = (plan: SessionPlan): boolean =>
  plan.status !== 'completed' &&
  plan.segments.some(
    (s) => s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted',
  );

const segStart = (s: SessionPlanSegment): number | null =>
  s.actualStartTime ?? (s.status !== 'pending' ? s.expectedStartTime : null);

const segEnd = (s: SessionPlanSegment): number | null => {
  if (s.actualEndTime) return s.actualEndTime;
  if (s.actualStartTime) return s.actualStartTime + (s.actualDuration ?? s.plannedDuration) * 1000;
  return s.status !== 'pending' ? s.expectedEndTime : null;
};

type Kind = 'focus' | 'short' | 'break';
const KIND_LABEL: Record<Kind, string> = {
  focus: 'Focus',
  short: 'Shorter session',
  break: 'Break',
};

interface Block {
  key: string;
  start: number;
  end: number;
  kind: Kind;
}

/** One day: a sentence, the sessions on an hour axis, and anything left to resume. */
export const DayTimeline: React.FC<DayTimelineProps> = ({
  dateLabel,
  plans,
  settings,
  onResumePlan,
}) => {
  const { palette, tokens } = useTheme();
  const at = (ms: number) => formatTime(new Date(ms), settings.timeFormat);

  const { blocks, axisStart, axisEnd, ticks, facts } = useMemo(() => {
    const bl: Block[] = [];
    let focusSeconds = 0;
    let focusSessions = 0;
    let firstStart: number | null = null;
    let lastEnd: number | null = null;

    for (const plan of plans) {
      for (const seg of plan.segments) {
        const isFocus = seg.type === SessionType.FOCUS;
        if (isFocus && (seg.status === 'completed' || seg.status === 'interrupted')) {
          focusSeconds += seg.actualDuration || 0;
          focusSessions += 1;
        }
        if (seg.actualStartTime && (firstStart == null || seg.actualStartTime < firstStart))
          firstStart = seg.actualStartTime;
        if (seg.actualEndTime && (lastEnd == null || seg.actualEndTime > lastEnd))
          lastEnd = seg.actualEndTime;

        if (seg.status === 'pending') continue;
        const s = segStart(seg);
        const e = segEnd(seg);
        if (s == null || e == null || e <= s) continue;
        const kind: Kind = !isFocus ? 'break' : seg.status === 'completed' ? 'focus' : 'short';
        bl.push({ key: seg.id, start: s, end: e, kind });
      }
    }

    const day = { focusSeconds, focusSessions, firstStart, lastEnd };
    if (bl.length === 0) return { blocks: bl, axisStart: 0, axisEnd: 0, ticks: [], facts: day };

    const aStart = Math.floor(Math.min(...bl.map((b) => b.start)) / HOUR) * HOUR;
    let aEnd = Math.ceil(Math.max(...bl.map((b) => b.end)) / HOUR) * HOUR;
    if (aEnd - aStart < HOUR) aEnd = aStart + HOUR;
    const step = aEnd - aStart > 8 * HOUR ? 2 * HOUR : HOUR;
    const tk: number[] = [];
    for (let t = aStart; t <= aEnd; t += step) tk.push(t);
    return { blocks: bl, axisStart: aStart, axisEnd: aEnd, ticks: tk, facts: day };
  }, [plans]);

  const color: Record<Kind, string> = {
    focus: palette.primary.main,
    short: alpha(palette.primary.main, 0.45),
    break: alpha(palette.secondary.main, 0.6),
  };
  const kindsShown = (Object.keys(KIND_LABEL) as Kind[]).filter((k) =>
    blocks.some((b) => b.kind === k),
  );
  const resumable = plans.filter(isResumable);
  const span = axisEnd - axisStart;

  return (
    <Box component="section" aria-labelledby="day-heading">
      <Typography id="day-heading" variant="h6" component="h2" sx={{ mb: 0.5 }}>
        {dateLabel}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        {daySummary(facts, settings.timeFormat)}
      </Typography>

      {blocks.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              position: 'relative',
              height: 48,
              borderRadius: `${radius.sm}px`,
              backgroundColor: tokens.surface.inset,
              border: `1px solid ${tokens.line.subtle}`,
              overflow: 'hidden',
            }}
          >
            {blocks.map((b) => {
              const left = ((b.start - axisStart) / span) * 100;
              const width = Math.max(((b.end - b.start) / span) * 100, 0.8);
              const isBreak = b.kind === 'break';
              return (
                <Tooltip
                  key={b.key}
                  disableInteractive
                  title={`${KIND_LABEL[b.kind]}, ${at(b.start)} to ${at(b.end)} (${formatSpan(
                    Math.round((b.end - b.start) / 1000),
                  )})`}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: isBreak ? 18 : 8,
                      bottom: isBreak ? 18 : 8,
                      borderRadius: '4px',
                      backgroundColor: color[b.kind],
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>

          <Box sx={{ position: 'relative', height: 18, mt: 0.75 }} aria-hidden="true">
            {ticks.map((t, i) => (
              <Typography
                key={t}
                variant="caption"
                sx={{
                  position: 'absolute',
                  left: `${((t - axisStart) / span) * 100}%`,
                  transform:
                    i === 0
                      ? 'none'
                      : i === ticks.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {at(t)}
              </Typography>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
            {kindsShown.map((k) => (
              <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color[k] }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {KIND_LABEL[k]}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {resumable.map((plan) => {
        const done = plan.segments.filter((s) => s.status === 'completed').length;
        const startedAt =
          plan.segments.find((s) => s.actualStartTime)?.actualStartTime ?? plan.createdAt;
        return (
          <Box
            key={plan.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mt: 2,
              py: 1.25,
              px: 2,
              borderRadius: `${radius.md}px`,
              border: `1px solid ${tokens.line.default}`,
              backgroundColor: tokens.surface.card,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Unfinished session from {at(startedAt)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {done} of {plan.segments.length} parts done. Pick up where you left off.
              </Typography>
            </Box>
            {onResumePlan && (
              <Button
                size="small"
                variant="contained"
                startIcon={<PlayArrow />}
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
  );
};
