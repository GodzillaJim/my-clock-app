import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { HistoryView } from '@/components/history/HistoryView';
import { buildAppTheme } from '@/theme/buildAppTheme';
import { datesUpTo, emptyDay, emptyLifetimeStats } from '@/features/stats/stats';
import {
  DEFAULT_SETTINGS,
  SessionType,
  getTodayDateString,
  type DailyHistory,
  type LifetimeStats,
  type SessionPlan,
} from '@/features/timer/types';

const mocks = vi.hoisted(() => ({
  recalculate: vi.fn(),
  forPeriod: vi.fn(),
  forDate: vi.fn(),
  byDate: vi.fn(),
}));

vi.mock('@/services/domain', () => ({
  services: {
    stats: { recalculate: mocks.recalculate },
    history: { forPeriod: mocks.forPeriod, byDate: mocks.byDate },
    plans: { forDate: mocks.forDate },
  },
}));

const H = 3600;
const today = getTodayDateString();
const [yesterday] = datesUpTo(today, 2);

const day = (date: string, focus: number): DailyHistory => ({
  ...emptyDay(date, Date.now()),
  totalFocusTime: focus,
});

const stats: LifetimeStats = {
  ...emptyLifetimeStats(),
  totalSessions: 9,
  totalFocusTime: 6 * H,
  totalDaysActive: 3,
  averageDailyFocusTime: H,
  currentDayStreak: 2,
  longestDayStreak: 4,
  overallCompletionRate: 0.9,
  averageDayStartTime: '09:00',
  averageDayEndTime: '12:30',
};

/** A finished plan of one focus segment and one interrupted one. */
const plan = (date: string): SessionPlan => {
  const start = Date.parse(`${date}T09:00:00Z`);
  const seg = (index: number, status: 'completed' | 'interrupted', minutes: number) => ({
    id: `${date}-${index}`,
    index,
    type: SessionType.FOCUS,
    plannedDuration: 25 * 60,
    actualDuration: minutes * 60,
    expectedStartTime: start + index * 30 * 60_000,
    expectedEndTime: start + index * 30 * 60_000 + 25 * 60_000,
    actualStartTime: start + index * 30 * 60_000,
    actualEndTime: start + index * 30 * 60_000 + minutes * 60_000,
    status,
    pausedTime: 0,
    elapsedAtLastUpdate: minutes * 60,
  });
  return {
    id: `plan-${date}`,
    createdAt: start,
    status: 'completed',
    segments: [seg(0, 'completed', 25), seg(1, 'interrupted', 10)],
    currentSegmentIndex: -1,
    settings: { focusDuration: 25, shortBreakDuration: 5 },
    expectedEndTime: start + H,
    actualEndTime: start + H,
    interruptedAt: null,
    totalPlannedDuration: 50 * 60,
    totalElapsed: 35 * 60,
    lastUpdated: start + H,
  };
};

const renderHistory = () =>
  render(
    <ThemeProvider theme={buildAppTheme({ theme: 'light' }, false)}>
      <HistoryView settings={DEFAULT_SETTINGS} onClose={() => {}} />
    </ThemeProvider>,
  );

describe('HistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recalculate.mockResolvedValue(stats);
    mocks.forPeriod.mockResolvedValue([day(yesterday, 2 * H), day(today, 2 * H)]);
    mocks.forDate.mockImplementation(async (date: string) =>
      date === yesterday ? [plan(yesterday)] : [],
    );
    mocks.byDate.mockResolvedValue(null);
  });

  it('opens with a sentence about today instead of a big number', async () => {
    renderHistory();
    expect(
      await screen.findByText(
        "You've focused for 2 h today, more than your usual 1 h. That's 2 days in a row.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('No focus sessions on this day.')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM and 12:30 PM')).toBeInTheDocument();
  });

  it('moves between days with the arrow keys and shows the chosen day', async () => {
    renderHistory();
    const todayCell = await screen.findByRole('button', { pressed: true });
    expect(todayCell).toHaveAttribute('data-date', today);
    expect(todayCell).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(todayCell, { key: 'ArrowUp' });

    expect(await screen.findByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute('data-date', yesterday);
    expect(mocks.forDate).toHaveBeenCalledWith(yesterday);
    // An interrupted session counts as focus, told as a shorter session
    expect(await screen.findByText(/^35 min of focus in 2 sessions/)).toBeInTheDocument();
    expect(screen.getByText('Shorter session')).toBeInTheDocument();

    // Today is the last day; moving past it stays put
    fireEvent.keyDown(screen.getByRole('button', { pressed: true }), { key: 'End' });
    await waitFor(() =>
      expect(screen.getByRole('button', { pressed: true })).toHaveAttribute('data-date', today),
    );
    fireEvent.keyDown(screen.getByRole('button', { pressed: true }), { key: 'ArrowRight' });
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute('data-date', today);
  });

  it('invites a first session when there is no history', async () => {
    mocks.recalculate.mockResolvedValue(emptyLifetimeStats());
    mocks.forPeriod.mockResolvedValue([]);
    renderHistory();
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the timer' })).toBeInTheDocument();
  });
});
