/**
 * Pure statistics over sessions, plans, days and challenges: streaks, totals
 * and averages. No storage and no clock; callers pass `now`.
 */
import {
  ChallengeDayStatus,
  ChallengeStatus,
  CompletionStatus,
  SessionType,
  type Challenge,
  type DailyHistory,
  type LifetimeStats,
  type PeriodSummary,
  type SessionPlan,
  type SessionRecord,
} from '@/features/timer/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const isFocus = (s: SessionRecord) => s.type === SessionType.FOCUS;
const isCompletedFocus = (s: SessionRecord) =>
  isFocus(s) && s.completionStatus === CompletionStatus.COMPLETED;
const startMs = (s: SessionRecord) => new Date(s.startTime).getTime();
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** `YYYY-MM-DD` in UTC, the date format the stores use for days. */
export const utcDate = (ms: number) => new Date(ms).toISOString().split('T')[0];

/** Longest run of completed focus sessions; breaks don't interrupt a run. */
export function longestFocusStreak(sessions: SessionRecord[]): number {
  let longest = 0;
  let run = 0;
  for (const s of [...sessions].sort((a, b) => startMs(a) - startMs(b))) {
    if (isCompletedFocus(s)) longest = Math.max(longest, ++run);
    else if (isFocus(s)) run = 0;
  }
  return longest;
}

export function emptyDay(date: string, now: number): DailyHistory {
  return {
    date,
    sessions: [],
    totalFocusTime: 0,
    totalBreakTime: 0,
    completedSessions: 0,
    interruptedSessions: 0,
    skippedSessions: 0,
    averageSessionLength: 0,
    longestStreak: 0,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    dayStartTime: null,
    dayEndTime: null,
    sessionPlanIds: [],
    totalPlannedTime: 0,
    totalActualTime: 0,
    completionRate: 0,
  };
}

/** The summary of one day, from its sessions and the plans started on it. */
export function summarizeDay(
  date: string,
  sessions: SessionRecord[],
  plans: SessionPlan[],
  now: number,
  createdAt: Date = new Date(now),
): DailyHistory {
  const byStatus = (status: CompletionStatus) =>
    sessions.filter((s) => s.completionStatus === status).length;
  const focusSeconds = sum(sessions.filter(isFocus).map((s) => s.actualDuration));
  const breakSeconds = sum(sessions.filter((s) => !isFocus(s)).map((s) => s.actualDuration));

  const starts = sessions.map(startMs).filter((t) => !isNaN(t));
  const ends = sessions
    .map((s) => (s.endTime ? new Date(s.endTime).getTime() : NaN))
    .filter((t) => !isNaN(t));

  const segments = plans.flatMap((p) => p.segments);
  return {
    date,
    sessions,
    totalFocusTime: focusSeconds,
    totalBreakTime: breakSeconds,
    completedSessions: byStatus(CompletionStatus.COMPLETED),
    interruptedSessions: byStatus(CompletionStatus.INTERRUPTED),
    skippedSessions: byStatus(CompletionStatus.SKIPPED),
    averageSessionLength: sessions.length > 0 ? focusSeconds / sessions.length : 0,
    longestStreak: longestFocusStreak(sessions),
    createdAt,
    updatedAt: new Date(now),
    dayStartTime: starts.length > 0 ? Math.min(...starts) : null,
    dayEndTime: ends.length > 0 ? Math.max(...ends) : null,
    sessionPlanIds: plans.map((p) => p.id),
    totalPlannedTime: sum(plans.map((p) => p.totalPlannedDuration)),
    totalActualTime: sum(plans.map((p) => p.totalElapsed)),
    completionRate:
      segments.length > 0
        ? segments.filter((s) => s.status === 'completed').length / segments.length
        : 0,
  };
}

const activeDays = (days: DailyHistory[]) => days.filter((d) => d.sessions.length > 0);

const focusCount = (days: DailyHistory[]) =>
  sum(days.map((d) => d.sessions.filter(isFocus).length));

/** Totals for the days within the last `days` days of `now`. */
export function summarizePeriod(history: DailyHistory[], days: number, now: number): PeriodSummary {
  const cutoff = utcDate(now - days * DAY_MS);
  const active = activeDays(history.filter((d) => d.date >= cutoff));
  const totalFocusTime = sum(active.map((d) => d.totalFocusTime));
  const focusSessions = focusCount(active);
  return {
    totalFocusTime,
    totalSessions: sum(active.map((d) => d.sessions.length)),
    averageDailyFocusTime: active.length > 0 ? totalFocusTime / active.length : 0,
    completionRate:
      focusSessions > 0 ? sum(active.map((d) => d.completedSessions)) / focusSessions : 0,
    daysActive: active.length,
  };
}

/** Average local time of day across timestamps, as `HH:mm`; `--:--` without data. */
function averageTimeOfDay(timestamps: number[]): string {
  if (timestamps.length === 0) return '--:--';
  const minutes = timestamps.map((t) => {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes();
  });
  const avg = Math.round(sum(minutes) / minutes.length);
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
}

/** Consecutive-day streaks over days with at least one completed session. */
export function dayStreaks(dates: string[], today: string): { current: number; longest: number } {
  const sorted = [...new Set(dates)].sort();
  let longest = 0;
  let run = 0;
  sorted.forEach((date, i) => {
    const gap = i === 0 ? 0 : Math.round((Date.parse(date) - Date.parse(sorted[i - 1])) / DAY_MS);
    run = gap === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });

  const present = new Set(sorted);
  let current = 0;
  for (let day = Date.parse(today); present.has(utcDate(day)); day -= DAY_MS) current++;
  return { current, longest };
}

export function emptyLifetimeStats(): LifetimeStats {
  const emptyPeriod: PeriodSummary = {
    totalFocusTime: 0,
    totalSessions: 0,
    averageDailyFocusTime: 0,
    completionRate: 0,
    daysActive: 0,
  };
  return {
    lastUpdated: 0,
    totalDaysActive: 0,
    totalSessions: 0,
    totalFocusTime: 0,
    totalBreakTime: 0,
    averageDayStartTime: '--:--',
    averageDayEndTime: '--:--',
    averageDailyFocusTime: 0,
    averageDailySessionCount: 0,
    averageSessionDuration: 0,
    currentDayStreak: 0,
    longestDayStreak: 0,
    overallCompletionRate: 0,
    totalInterruptedSessions: 0,
    last7Days: emptyPeriod,
    last30Days: emptyPeriod,
  };
}

/** Lifetime statistics over every stored day (each with its sessions loaded). */
export function summarizeLifetime(history: DailyHistory[], now: number): LifetimeStats {
  const active = activeDays(history);
  const totalSessions = sum(active.map((d) => d.sessions.length));
  const totalFocusTime = sum(active.map((d) => d.totalFocusTime));
  const totalBreakTime = sum(active.map((d) => d.totalBreakTime));
  const focusSessions = focusCount(active);
  const streaks = dayStreaks(
    active.filter((d) => d.completedSessions > 0).map((d) => d.date),
    utcDate(now),
  );

  return {
    lastUpdated: now,
    totalDaysActive: active.length,
    totalSessions,
    totalFocusTime,
    totalBreakTime,
    averageDayStartTime: averageTimeOfDay(
      active.map((d) => d.dayStartTime).filter((t): t is number => !!t),
    ),
    averageDayEndTime: averageTimeOfDay(
      active.map((d) => d.dayEndTime).filter((t): t is number => !!t),
    ),
    averageDailyFocusTime: active.length > 0 ? totalFocusTime / active.length : 0,
    averageDailySessionCount: active.length > 0 ? totalSessions / active.length : 0,
    averageSessionDuration:
      totalSessions > 0 ? (totalFocusTime + totalBreakTime) / totalSessions : 0,
    currentDayStreak: streaks.current,
    longestDayStreak: streaks.longest,
    overallCompletionRate:
      focusSessions > 0 ? sum(active.map((d) => d.completedSessions)) / focusSessions : 0,
    totalInterruptedSessions: sum(active.map((d) => d.interruptedSessions)),
    last7Days: summarizePeriod(history, 7, now),
    last30Days: summarizePeriod(history, 30, now),
  };
}

/** Day counts and streaks of a challenge. Failed days break a streak; pending days don't. */
export function challengeProgress(
  challenge: Challenge,
): Pick<Challenge, 'completedDays' | 'failedDays' | 'currentStreak' | 'longestStreak'> {
  const days = [...challenge.days].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.status === ChallengeDayStatus.COMPLETED) longest = Math.max(longest, ++run);
    else if (day.status === ChallengeDayStatus.FAILED) run = 0;
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].status === ChallengeDayStatus.COMPLETED) current++;
    else if (days[i].status === ChallengeDayStatus.FAILED) break;
  }
  return {
    completedDays: days.filter((d) => d.status === ChallengeDayStatus.COMPLETED).length,
    failedDays: days.filter((d) => d.status === ChallengeDayStatus.FAILED).length,
    currentStreak: current,
    longestStreak: longest,
  };
}

/**
 * A challenge that has ended with every day marked is completed at an 80%
 * success rate, failed below it; otherwise its status is unchanged.
 */
export function challengeStatus(challenge: Challenge, today: string): ChallengeStatus {
  const allMarked = challenge.days.every((d) => d.status !== ChallengeDayStatus.PENDING);
  if (challenge.endDate >= today || !allMarked || challenge.days.length === 0) {
    return challenge.status;
  }
  const rate = challengeProgress(challenge).completedDays / challenge.days.length;
  return rate >= 0.8 ? ChallengeStatus.COMPLETED : ChallengeStatus.FAILED;
}
