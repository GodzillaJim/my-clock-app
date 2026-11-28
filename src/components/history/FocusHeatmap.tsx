import React, { useMemo, useRef } from 'react';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import { datesUpTo } from '@/features/stats/stats';
import { formatSpan } from '@/features/stats/historyCopy';
import { motion, radius } from '@/theme/tokens';

interface FocusHeatmapProps {
  /** Store date (YYYY-MM-DD) → focus seconds that day. */
  focusByDate: Map<string, number>;
  /** Today's store date: the last cell. */
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  weeks?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 14;
const GAP = 4;
const LABEL_W = 32;

/** Fixed, meaningful thresholds (minutes) rather than relative quantiles. */
const levelFor = (seconds: number): number => {
  const m = seconds / 60;
  if (m <= 0) return 0;
  if (m < 30) return 1;
  if (m < 60) return 2;
  if (m < 120) return 3;
  return 4;
};

const LEVEL_NAMES = ['None', 'Under 30 min', '30 min to 1 h', '1 to 2 h', '2 h or more'];

/** Store dates are UTC days, so the grid is laid out in UTC too. */
const parse = (date: string) => new Date(`${date}T00:00:00Z`);
const longLabel = (date: string) =>
  parse(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * Twelve weeks of focus, one cell per day. It is a single tab stop: arrow keys
 * move between days (left and right by week, up and down by day) and the
 * selected day shows below.
 */
export const FocusHeatmap: React.FC<FocusHeatmapProps> = ({
  focusByDate,
  today,
  selectedDate,
  onSelectDate,
  weeks = 12,
}) => {
  const { palette, tokens } = useTheme();
  const gridRef = useRef<HTMLDivElement>(null);

  const { dates, columns, monthLabels } = useMemo(() => {
    const all = datesUpTo(today, weeks * 7);
    // Pad the front so each column runs Sunday to Saturday
    const lead = parse(all[0]).getUTCDay();
    const padded: (string | null)[] = [...Array<null>(lead).fill(null), ...all];
    while (padded.length % 7 !== 0) padded.push(null);
    const cols: (string | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));

    const labels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, ci) => {
      const first = col.find(Boolean);
      if (!first) return;
      const month = parse(first).getUTCMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        labels.push({ col: ci, text: MONTHS[month] });
      }
    });
    return { dates: all, columns: cols, monthLabels: labels };
  }, [today, weeks]);

  const fill = (level: number) =>
    level === 0 ? tokens.overlay.track : alpha(palette.primary.main, [0, 0.3, 0.5, 0.75, 1][level]);

  const move = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    };
    let index = dates.indexOf(selectedDate);
    if (event.key in steps) index += steps[event.key];
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = dates.length - 1;
    else return;
    event.preventDefault();
    const next = dates[Math.max(0, Math.min(dates.length - 1, index))];
    onSelectDate(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  };

  const colWidth = CELL + GAP;

  return (
    <Box>
      <Box sx={{ position: 'relative', height: 18, ml: `${LABEL_W}px` }} aria-hidden="true">
        {monthLabels.map(({ col, text }) => (
          <Typography
            key={`${col}-${text}`}
            variant="caption"
            sx={{ position: 'absolute', left: col * colWidth, color: 'text.secondary' }}
          >
            {text}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: `${GAP}px` }}>
        <Box
          aria-hidden="true"
          sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, width: LABEL_W - GAP }}
        >
          {WEEKDAYS.map((day, i) => (
            <Typography
              key={day}
              variant="caption"
              sx={{
                height: CELL,
                lineHeight: `${CELL}px`,
                fontSize: '0.6875rem',
                color: 'text.secondary',
                visibility: i % 2 === 1 ? 'visible' : 'hidden',
              }}
            >
              {day}
            </Typography>
          ))}
        </Box>

        <Box
          ref={gridRef}
          role="group"
          aria-label="Focus per day, last 12 weeks"
          onKeyDown={move}
          sx={{ display: 'flex', gap: `${GAP}px` }}
        >
          {columns.map((col, ci) => (
            <Box key={ci} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
              {col.map((date, ri) => {
                if (!date) return <Box key={ri} sx={{ width: CELL, height: CELL }} />;
                const seconds = focusByDate.get(date) ?? 0;
                const level = levelFor(seconds);
                const selected = date === selectedDate;
                const amount = seconds > 0 ? `${formatSpan(seconds)} of focus` : 'no focus';
                return (
                  <Tooltip
                    key={date}
                    title={`${longLabel(date)}: ${amount}`}
                    enterDelay={300}
                    disableInteractive
                  >
                    <Box
                      component="button"
                      type="button"
                      data-date={date}
                      aria-label={`${longLabel(date)}, ${amount}`}
                      aria-pressed={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => onSelectDate(date)}
                      sx={{
                        display: 'block',
                        p: 0,
                        border: 0,
                        width: CELL,
                        height: CELL,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: fill(level),
                        boxShadow: selected
                          ? `0 0 0 2px ${palette.background.default}, 0 0 0 3.5px ${palette.text.primary}`
                          : date === today
                            ? `inset 0 0 0 1.5px ${tokens.line.strong}`
                            : 'none',
                        transition: `box-shadow ${motion.fast} ${motion.easeOut}`,
                        '&:hover': { boxShadow: `0 0 0 1.5px ${tokens.line.strong}` },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, ml: `${LABEL_W}px` }}
        aria-hidden="true"
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
          Less
        </Typography>
        {LEVEL_NAMES.map((name, level) => (
          <Tooltip key={name} title={name} disableInteractive>
            <Box
              sx={{
                width: 11,
                height: 11,
                borderRadius: `${radius.sm / 3}px`,
                bgcolor: fill(level),
              }}
            />
          </Tooltip>
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
          More
        </Typography>
      </Box>
    </Box>
  );
};
