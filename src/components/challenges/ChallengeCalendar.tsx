import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { ChallengeDay, ChallengeDayStatus } from '@/features/timer/types';
import dayjs from 'dayjs';

interface ChallengeCalendarProps {
  days: ChallengeDay[];
  onDayClick?: (day: ChallengeDay) => void;
  compact?: boolean;
}

export const ChallengeCalendar: React.FC<ChallengeCalendarProps> = ({
  days,
  onDayClick,
  compact = false,
}) => {
  const getStatusColor = (status: ChallengeDayStatus): string => {
    switch (status) {
      case ChallengeDayStatus.COMPLETED:
        return '#4ADE80';
      case ChallengeDayStatus.FAILED:
        return '#F87171';
      case ChallengeDayStatus.SKIPPED:
        return '#FBBF24';
      case ChallengeDayStatus.PENDING:
      default:
        return 'rgba(255, 255, 255, 0.1)';
    }
  };

  const today = dayjs().format('YYYY-MM-DD');
  const cellSize = compact ? 16 : 24;
  const gap = compact ? 2 : 4;

  // Group days by week for grid layout
  const weeks: (ChallengeDay | null)[][] = [];
  let currentWeek: (ChallengeDay | null)[] = [];

  days.forEach((day, index) => {
    const dayOfWeek = dayjs(day.date).day();

    // Pad beginning of first week
    if (index === 0) {
      for (let i = 0; i < dayOfWeek; i++) {
        currentWeek.push(null);
      }
    }

    currentWeek.push(day);

    if (dayOfWeek === 6 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <Box>
      {!compact && (
        <Box sx={{ display: 'flex', gap: `${gap}px`, mb: 1, pl: '20px' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{
                width: cellSize,
                textAlign: 'center',
                color: 'text.secondary',
                fontSize: '0.65rem',
              }}
            >
              {day}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
        {weeks.map((week, weekIndex) => (
          <Box key={weekIndex} sx={{ display: 'flex', gap: `${gap}px` }}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <Box
                    key={`empty-${dayIndex}`}
                    sx={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 1,
                    }}
                  />
                );
              }

              const isToday = day.date === today;
              const isPast = day.date < today;
              const canMark = isPast || isToday;

              return (
                <Tooltip
                  key={day.date}
                  title={
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        {dayjs(day.date).format('MMM D, YYYY')}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', textTransform: 'capitalize' }}
                      >
                        Status: {day.status}
                      </Typography>
                      {day.note && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Note: {day.note}
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <Box
                    onClick={() => canMark && onDayClick?.(day)}
                    sx={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 1,
                      backgroundColor: getStatusColor(day.status),
                      border: isToday ? '2px solid' : 'none',
                      borderColor: 'primary.main',
                      cursor: canMark && onDayClick ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      opacity: !isPast && !isToday ? 0.4 : 1,
                      '&:hover':
                        canMark && onDayClick
                          ? {
                              transform: 'scale(1.2)',
                            }
                          : {},
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      {!compact && (
        <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
          {[
            { status: ChallengeDayStatus.COMPLETED, label: 'Completed' },
            { status: ChallengeDayStatus.FAILED, label: 'Failed' },
            { status: ChallengeDayStatus.PENDING, label: 'Pending' },
          ].map(({ status, label }) => (
            <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  backgroundColor: getStatusColor(status),
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
