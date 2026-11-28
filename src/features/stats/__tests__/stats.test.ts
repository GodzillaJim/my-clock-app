import { describe, expect, it } from 'vitest';
import {
  challengeProgress,
  challengeStatus,
  dayStreaks,
  emptyDay,
  emptyLifetimeStats,
  longestFocusStreak,
  summarizeDay,
  summarizeLifetime,
  summarizePeriod,
  utcDate,
} from '../stats';
import {
  ChallengeDayStatus,
  ChallengeStatus,
  CompletionStatus,
  SessionType,
  type Challenge,
  type DailyHistory,
  type SessionPlan,
  type SessionRecord,
} from '@/features/timer/types';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const HOUR = 3_600_000;

let n = 0;
const s = (
  status: CompletionStatus,
  opts: { type?: SessionType; at?: number; duration?: number } = {},
): SessionRecord => {
  const at = opts.at ?? NOW - (100 - ++n) * 60_000;
  return {
    id: `s${n}`,
    type: opts.type ?? SessionType.FOCUS,
    sessionNumber: 1,
    plannedDuration: 1500,
    actualDuration: opts.duration ?? 1500,
    startTime: new Date(at),
    endTime: new Date(at + 1_500_000),
    pausedTime: 0,
    completionStatus: status,
    remainingTime: 0,
  };
};
const { COMPLETED, INTERRUPTED, SKIPPED } = CompletionStatus;

describe('longestFocusStreak', () => {
  it('counts consecutive completed focus sessions; breaks do not interrupt a run', () => {
    expect(
      longestFocusStreak([
        s(COMPLETED),
        s(COMPLETED, { type: SessionType.SHORT_BREAK }),
        s(COMPLETED),
        s(INTERRUPTED),
        s(COMPLETED),
      ]),
    ).toBe(2);
    expect(longestFocusStreak([])).toBe(0);
  });

  it('orders sessions by start time first', () => {
    const late = s(COMPLETED, { at: NOW });
    const early = s(INTERRUPTED, { at: NOW - HOUR });
    expect(longestFocusStreak([late, early])).toBe(1);
  });
});

describe('summarizeDay', () => {
  const plan = (statuses: string[], planned: number, elapsed: number): SessionPlan =>
    ({
      id: `p${planned}`,
      totalPlannedDuration: planned,
      totalElapsed: elapsed,
      segments: statuses.map((status) => ({ status })),
    }) as unknown as SessionPlan;

  it('totals sessions by type and status and summarizes the day’s plans', () => {
    const sessions = [
      s(COMPLETED, { at: NOW - 3 * HOUR }),
      s(COMPLETED, { at: NOW - 2 * HOUR, type: SessionType.SHORT_BREAK, duration: 300 }),
      s(INTERRUPTED, { at: NOW - HOUR, duration: 600 }),
      s(SKIPPED, { at: NOW - HOUR / 2, duration: 60 }),
    ];
    const plans = [
      plan(['completed', 'completed', 'skipped'], 3600, 3000),
      plan(['pending'], 600, 0),
    ];
    const day = summarizeDay('2026-03-10', sessions, plans, NOW, new Date(0));

    expect(day).toMatchObject({
      totalFocusTime: 1500 + 600 + 60,
      totalBreakTime: 300,
      completedSessions: 2,
      interruptedSessions: 1,
      skippedSessions: 1,
      averageSessionLength: (1500 + 600 + 60) / 4,
      longestStreak: 1,
      dayStartTime: NOW - 3 * HOUR,
      dayEndTime: NOW - HOUR / 2 + 1_500_000,
      sessionPlanIds: ['p3600', 'p600'],
      totalPlannedTime: 4200,
      totalActualTime: 3000,
      completionRate: 2 / 4,
      createdAt: new Date(0),
      updatedAt: new Date(NOW),
    });
  });

  it('is empty for a day without activity', () => {
    expect(summarizeDay('2026-03-10', [], [], NOW)).toEqual(emptyDay('2026-03-10', NOW));
  });
});

describe('dayStreaks', () => {
  it('finds the longest run of consecutive days and the run ending today', () => {
    const dates = [
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ];
    expect(dayStreaks(dates, '2026-03-10')).toEqual({ current: 3, longest: 3 });
    expect(dayStreaks(['2026-03-01', '2026-03-02'], '2026-03-10')).toEqual({
      current: 0,
      longest: 2,
    });
    expect(dayStreaks([], '2026-03-10')).toEqual({ current: 0, longest: 0 });
  });

  it('ignores duplicates and order', () => {
    expect(dayStreaks(['2026-03-10', '2026-03-09', '2026-03-10'], '2026-03-10')).toEqual({
      current: 2,
      longest: 2,
    });
  });
});

const day = (date: string, sessions: SessionRecord[], extra: Partial<DailyHistory> = {}) => ({
  ...summarizeDay(date, sessions, [], NOW),
  ...extra,
});

describe('summarizePeriod', () => {
  it('only counts active days inside the period', () => {
    const history = [
      day('2026-03-09', [s(COMPLETED), s(INTERRUPTED)]),
      day('2026-03-08', []),
      day('2026-02-01', [s(COMPLETED)]), // outside 7 days
    ];
    expect(summarizePeriod(history, 7, NOW)).toEqual({
      totalFocusTime: 3000,
      totalSessions: 2,
      averageDailyFocusTime: 3000,
      completionRate: 0.5,
      daysActive: 1,
    });
  });
});

describe('summarizeLifetime', () => {
  it('aggregates every active day', () => {
    const history = [
      day('2026-03-10', [s(COMPLETED), s(COMPLETED)]),
      day('2026-03-09', [s(COMPLETED), s(INTERRUPTED)]),
      day('2026-03-01', []),
    ];
    const stats = summarizeLifetime(history, NOW);
    expect(stats).toMatchObject({
      lastUpdated: NOW,
      totalDaysActive: 2,
      totalSessions: 4,
      totalFocusTime: 4 * 1500,
      averageDailySessionCount: 2,
      currentDayStreak: 2,
      longestDayStreak: 2,
      overallCompletionRate: 3 / 4,
      totalInterruptedSessions: 1,
    });
    expect(stats.averageDayStartTime).toMatch(/^\d{2}:\d{2}$/);
    expect(stats.last7Days.daysActive).toBe(2);
  });

  it('has nothing to report without activity', () => {
    expect(summarizeLifetime([], NOW)).toEqual({ ...emptyLifetimeStats(), lastUpdated: NOW });
  });
});

describe('challenges', () => {
  const challenge = (statuses: ChallengeDayStatus[], endDate = '2026-03-09'): Challenge => ({
    id: 'c',
    name: 'c',
    startDate: '2026-03-01',
    endDate,
    durationDays: statuses.length,
    status: ChallengeStatus.ACTIVE,
    days: statuses.map((status, i) => ({ date: `2026-03-0${i + 1}`, status })),
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    completedDays: 0,
    failedDays: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const { COMPLETED: C, FAILED: F, PENDING: P, SKIPPED: K } = ChallengeDayStatus;

  it('counts days and streaks; failed days break a streak, skipped and pending do not', () => {
    expect(challengeProgress(challenge([C, C, F, C, K, C, P]))).toEqual({
      completedDays: 4,
      failedDays: 1,
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('decides the outcome only once the challenge is over and fully marked', () => {
    const today = utcDate(NOW);
    expect(challengeStatus(challenge([C, C, C, C, F]), today)).toBe(ChallengeStatus.COMPLETED);
    expect(challengeStatus(challenge([C, C, C, F, F]), today)).toBe(ChallengeStatus.FAILED);
    expect(challengeStatus(challenge([C, P]), today)).toBe(ChallengeStatus.ACTIVE);
    expect(challengeStatus(challenge([C, C], '2026-03-20'), today)).toBe(ChallengeStatus.ACTIVE);
    expect(challengeStatus(challenge([]), today)).toBe(ChallengeStatus.ACTIVE);
  });
});
