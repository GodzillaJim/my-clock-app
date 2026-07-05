import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { formatDurationFromSeconds } from '@/features/timer/types';

interface FocusHeatmapProps {
  /** Map of YYYY-MM-DD -> focus seconds for that day. */
  focusByDate: Map<string, number>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  weeks?: number;
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dateKey = (d: Date): string => d.toISOString().split('T')[0];

// Fixed, meaningful thresholds (minutes) rather than relative quantiles.
const levelFor = (seconds: number): number => {
  const m = seconds / 60;
  if (m <= 0) return 0;
  if (m < 30) return 1;
  if (m < 60) return 2;
  if (m < 120) return 3;
  return 4;
};

const CELL = 13;
const GAP = 4;

export const FocusHeatmap: React.FC<FocusHeatmapProps> = ({
  focusByDate,
  selectedDate,
  onSelectDate,
  weeks = 12,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const todayKey = dateKey(new Date());

  const { columns, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    // Pad the front so the first column begins on Sunday, and the back to fill
    // the final week, keeping every column a clean 7-cell run.
    const padded: (Date | null)[] = [];
    const firstDow = days[0].getDay();
    for (let k = 0; k < firstDow; k++) padded.push(null);
    padded.push(...days);
    while (padded.length % 7 !== 0) padded.push(null);

    const cols: (Date | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));

    // A month label sits above the first column where a new month appears.
    const labels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, ci) => {
      const firstReal = col.find(Boolean) as Date | undefined;
      if (firstReal && firstReal.getMonth() !== lastMonth) {
        lastMonth = firstReal.getMonth();
        labels.push({ col: ci, text: MONTHS[firstReal.getMonth()] });
      }
    });

    return { columns: cols, monthLabels: labels };
  }, [weeks]);

  const cellColor = (level: number): string =>
    level === 0
      ? alpha(theme.palette.text.primary, isDark ? 0.07 : 0.05)
      : alpha(theme.palette.primary.main, [0, 0.3, 0.5, 0.72, 1][level]);

  const colWidth = CELL + GAP;

  return (
    <Box>
      {/* Month labels aligned to columns */}
      <Box sx={{ display: 'flex', pl: '34px', height: 16, position: 'relative' }}>
        {monthLabels.map(({ col, text }) => (
          <Typography
            key={`${col}-${text}`}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${34 + col * colWidth}px`,
              color: 'text.secondary',
              fontSize: '0.68rem',
            }}
          >
            {text}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: `${GAP}px` }}>
        {/* Weekday labels */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, width: 30, flexShrink: 0 }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Box key={i} sx={{ height: CELL, display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.62rem' }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Week columns */}
        <Box sx={{ display: 'flex', gap: `${GAP}px`, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {columns.map((col, ci) => (
            <Box key={ci} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
              {col.map((day, ri) => {
                if (!day) return <Box key={ri} sx={{ width: CELL, height: CELL }} />;
                const key = dateKey(day);
                const isFuture = key > todayKey;
                if (isFuture) return <Box key={ri} sx={{ width: CELL, height: CELL }} />;

                const seconds = focusByDate.get(key) || 0;
                const level = levelFor(seconds);
                const isSelected = key === selectedDate;
                const isToday = key === todayKey;
                const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                return (
                  <Tooltip
                    key={ri}
                    arrow
                    title={
                      <Box sx={{ textAlign: 'center', py: 0.25 }}>
                        <div style={{ fontWeight: 600 }}>{label}</div>
                        <div>{seconds > 0 ? `${formatDurationFromSeconds(seconds)} focus` : 'No focus'}</div>
                      </Box>
                    }
                  >
                    <Box
                      role="button"
                      aria-label={`${label}: ${seconds > 0 ? formatDurationFromSeconds(seconds) : 'no'} focus`}
                      onClick={() => onSelectDate(key)}
                      sx={{
                        width: CELL,
                        height: CELL,
                        borderRadius: '3px',
                        backgroundColor: cellColor(level),
                        cursor: 'pointer',
                        transition: 'transform 120ms cubic-bezier(0.22,1,0.36,1), box-shadow 120ms',
                        boxShadow: isSelected
                          ? `0 0 0 2px ${theme.palette.background.default}, 0 0 0 3.5px ${theme.palette.primary.main}`
                          : isToday
                            ? `inset 0 0 0 1.5px ${alpha(theme.palette.text.primary, 0.45)}`
                            : 'none',
                        '&:hover': { transform: 'scale(1.18)' },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, pl: '34px' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5, fontSize: '0.65rem' }}>
          Less
        </Typography>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <Box key={lvl} sx={{ width: 11, height: 11, borderRadius: '2px', backgroundColor: cellColor(lvl) }} />
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5, fontSize: '0.65rem' }}>
          More
        </Typography>
      </Box>
    </Box>
  );
};
