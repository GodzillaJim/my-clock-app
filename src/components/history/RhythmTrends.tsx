import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { LifetimeStats, formatDurationFromSeconds } from '@/features/timer/types';

interface RhythmTrendsProps {
  stats: LifetimeStats;
  /** Oldest -> newest daily focus seconds, ~30 days. */
  series: { date: string; seconds: number }[];
}

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace';

const Fact: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <Box>
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', letterSpacing: '0.08em', display: 'block' }}
    >
      {label}
    </Typography>
    <Typography
      sx={{
        fontFamily: MONO,
        fontWeight: 600,
        fontSize: '1.05rem',
        color: color || 'text.primary',
      }}
    >
      {value}
    </Typography>
  </Box>
);

const Sparkbars: React.FC<{ series: { date: string; seconds: number }[] }> = ({ series }) => {
  const theme = useTheme();
  const max = Math.max(1, ...series.map((d) => d.seconds));
  const W = 100;
  const H = 30;
  const n = series.length || 1;
  const gap = 0.5;
  const bw = Math.max(0.5, W / n - gap);

  return (
    <Box sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 64, display: 'block' }}
      >
        {series.map((d, i) => {
          const h = d.seconds > 0 ? Math.max(1.2, (d.seconds / max) * H) : 0;
          const x = i * (W / n);
          const isToday = i === series.length - 1;
          return (
            <rect
              key={d.date}
              x={x}
              y={H - h}
              width={bw}
              height={h}
              rx={0.6}
              fill={
                d.seconds > 0
                  ? isToday
                    ? theme.palette.primary.main
                    : alpha(theme.palette.primary.main, 0.55)
                  : alpha(theme.palette.text.primary, 0.08)
              }
            />
          );
        })}
      </svg>
    </Box>
  );
};

export const RhythmTrends: React.FC<RhythmTrendsProps> = ({ stats, series }) => {
  const theme = useTheme();

  const { periodTotal, bestDayLabel } = useMemo(() => {
    const total = series.reduce((sum, d) => sum + d.seconds, 0);
    let best = series[0];
    for (const d of series) if (!best || d.seconds > best.seconds) best = d;
    const bestLabel =
      best && best.seconds > 0
        ? new Date(`${best.date}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : '—';
    return { periodTotal: total, bestDayLabel: bestLabel };
  }, [series]);

  // 7d vs 30d daily-average momentum
  const d7 = stats.last7Days.averageDailyFocusTime;
  const d30 = stats.last30Days.averageDailyFocusTime;
  const diff = d7 - d30;
  const meaningful = Math.abs(diff) >= 5 * 60;
  const TrendIcon = !meaningful ? TrendingFlat : diff > 0 ? TrendingUp : TrendingDown;
  const trendColor = !meaningful
    ? theme.palette.text.secondary
    : diff > 0
      ? theme.palette.success.main
      : theme.palette.text.secondary;

  return (
    <Box>
      {/* 30-day rhythm */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="overline" sx={{ letterSpacing: '0.14em', color: 'text.secondary' }}>
          Last 30 days
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: MONO }}>
          {formatDurationFromSeconds(periodTotal)} total
        </Typography>
      </Box>
      <Sparkbars series={series} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, mb: 3 }}>
        <TrendIcon sx={{ fontSize: 18, color: trendColor }} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          7-day avg{' '}
          <Box component="span" sx={{ color: 'text.primary', fontFamily: MONO, fontWeight: 600 }}>
            {formatDurationFromSeconds(d7)}
          </Box>
          {meaningful ? (diff > 0 ? ' , ahead of ' : ' , behind ') : ' , in line with '}
          your 30-day pace
        </Typography>
      </Box>

      {/* Rhythm facts */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 2.5,
          py: 2.5,
          borderTop: `1px solid ${theme.palette.divider}`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Fact label="AVG START" value={stats.averageDayStartTime} />
        <Fact label="AVG END" value={stats.averageDayEndTime} />
        <Fact
          label="AVG / DAY"
          value={formatDurationFromSeconds(stats.averageDailyFocusTime)}
          color={theme.palette.primary.main}
        />
        <Tooltip title="Your most focused day in the last 30" arrow>
          <Box>
            <Fact label="BEST DAY" value={bestDayLabel} />
          </Box>
        </Tooltip>
      </Box>

      {/* Lifetime footing */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 2.5,
          pt: 2.5,
        }}
      >
        <Fact
          label="LIFETIME FOCUS"
          value={formatDurationFromSeconds(stats.totalFocusTime)}
          color={theme.palette.primary.main}
        />
        <Fact label="DAYS ACTIVE" value={String(stats.totalDaysActive)} />
        <Fact
          label="LONGEST STREAK"
          value={`${stats.longestDayStreak}d`}
          color={stats.longestDayStreak > 0 ? theme.palette.warning.main : undefined}
        />
        <Fact
          label="COMPLETION"
          value={`${Math.round(stats.overallCompletionRate * 100)}%`}
          color={theme.palette.success.main}
        />
      </Box>
    </Box>
  );
};
