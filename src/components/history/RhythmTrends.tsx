import React, { useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { LifetimeStats } from '@/features/timer/types';
import { clockLabel, formatSpan, paceSummary } from '@/features/stats/historyCopy';

interface RhythmTrendsProps {
  stats: LifetimeStats;
  /** Daily focus seconds for the last 30 days, oldest first. */
  series: { date: string; seconds: number }[];
  timeFormat: '12h' | '24h';
}

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** Thirty days as quiet bars; today is the one solid bar. */
const Bars: React.FC<{ series: { date: string; seconds: number }[] }> = ({ series }) => {
  const { palette, tokens } = useTheme();
  const max = Math.max(1, ...series.map((d) => d.seconds));
  const W = 100;
  const H = 30;
  const n = series.length || 1;
  const bw = Math.max(0.5, W / n - 0.8);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: '100%', height: 64, display: 'block' }}
    >
      {series.map((d, i) => {
        const h = d.seconds > 0 ? Math.max(1.5, (d.seconds / max) * H) : 0.6;
        const isToday = i === series.length - 1;
        return (
          <rect
            key={d.date}
            x={i * (W / n)}
            y={H - h}
            width={bw}
            height={h}
            rx={0.6}
            fill={
              d.seconds === 0
                ? tokens.overlay.track
                : isToday
                  ? palette.primary.main
                  : alpha(palette.primary.main, 0.45)
            }
          />
        );
      })}
    </svg>
  );
};

/** The last 30 days in a sentence and bars, then the longer view as a short list of facts. */
export const RhythmTrends: React.FC<RhythmTrendsProps> = ({ stats, series, timeFormat }) => {
  const { tokens } = useTheme();

  const { total, best } = useMemo(() => {
    let top: { date: string; seconds: number } | null = null;
    for (const d of series) if (d.seconds > 0 && (!top || d.seconds > top.seconds)) top = d;
    return { total: series.reduce((sum, d) => sum + d.seconds, 0), best: top };
  }, [series]);

  const start = clockLabel(stats.averageDayStartTime, timeFormat);
  const end = clockLabel(stats.averageDayEndTime, timeFormat);
  const facts: [string, string][] = [
    ['A usual day', formatSpan(stats.averageDailyFocusTime)],
    ...(start && end ? ([['Usually between', `${start} and ${end}`]] as [string, string][]) : []),
    ...(best
      ? ([['Best day this month', `${dayLabel(best.date)}, ${formatSpan(best.seconds)}`]] as [
          string,
          string,
        ][])
      : []),
    [
      'All time',
      `${formatSpan(stats.totalFocusTime)} over ${stats.totalDaysActive} ${
        stats.totalDaysActive === 1 ? 'day' : 'days'
      }`,
    ],
    [
      'Longest run',
      `${stats.longestDayStreak} ${stats.longestDayStreak === 1 ? 'day' : 'days'} in a row`,
    ],
    ['Finished as planned', `${Math.round(stats.overallCompletionRate * 100)}% of sessions`],
  ];

  return (
    <Box component="section" aria-labelledby="rhythm-heading">
      <Typography id="rhythm-heading" variant="h6" component="h2" sx={{ mb: 0.5 }}>
        Last 30 days
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        {total > 0 ? `${formatSpan(total)} in total. ` : ''}
        {paceSummary(stats.last7Days.averageDailyFocusTime, stats.last30Days.averageDailyFocusTime)}
      </Typography>
      <Bars series={series} />

      <Box component="dl" sx={{ m: 0, mt: 3 }}>
        {facts.map(([label, value]) => (
          <Box
            key={label}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              py: 1.25,
              borderTop: `1px solid ${tokens.line.subtle}`,
            }}
          >
            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
