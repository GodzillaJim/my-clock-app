import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb, type FocusDb } from '../../db';
import { createServices } from '..';
import {
  ChallengeDayStatus,
  ChallengeStatus,
  CompletionStatus,
  DEFAULT_SETTINGS,
  SessionType,
  createChallengeDays,
  type SessionPlan,
  type SessionRecord,
} from '@/features/timer/types';

// Mid-day UTC, so local and UTC dates agree in any time zone the tests run in
const NOW = new Date('2026-03-10T12:00:00Z');
const TODAY = '2026-03-10';

let db: FocusDb;
let services: ReturnType<typeof createServices>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  db = createMemoryDb();
  services = createServices(db);
});

afterEach(() => vi.useRealTimers());

const session = (
  id: string,
  minutesAgo: number,
  status: CompletionStatus,
  type = SessionType.FOCUS,
): SessionRecord => ({
  id,
  type,
  sessionNumber: 1,
  plannedDuration: 1500,
  actualDuration: 1500,
  startTime: new Date(NOW.getTime() - minutesAgo * 60_000),
  endTime: new Date(NOW.getTime() - minutesAgo * 60_000 + 1_500_000),
  pausedTime: 0,
  completionStatus: status,
  remainingTime: 0,
});

describe('settings', () => {
  it('returns defaults, then merges saved settings over them', async () => {
    expect((await services.settings.load()).settings).toEqual(DEFAULT_SETTINGS);

    const state = await services.settings.load();
    await services.settings.save({ ...state, settings: { ...state.settings, focusDuration: 40 } });
    // A state saved by an older version lacks newer settings; defaults fill them in
    const stored = await db.kv.get('app_state');
    const { enableTickSound: _dropped, ...olderSettings } = stored!.settings;
    await db.kv.set('app_state', { ...stored!, settings: olderSettings as never });

    const loaded = await services.settings.load();
    expect(loaded.settings.focusDuration).toBe(40);
    expect(loaded.settings.enableTickSound).toBe(DEFAULT_SETTINGS.enableTickSound);
  });
});

describe('sessions and history', () => {
  it('refreshes the day summary whenever a session is added', async () => {
    await services.sessions.add(session('a', 120, CompletionStatus.COMPLETED));
    await services.sessions.add(session('b', 60, CompletionStatus.COMPLETED));
    await services.sessions.add(session('c', 30, CompletionStatus.INTERRUPTED));
    await services.sessions.add(
      session('d', 10, CompletionStatus.COMPLETED, SessionType.SHORT_BREAK),
    );

    const today = await services.history.today();
    expect(today.date).toBe(TODAY);
    expect(today.sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(today).toMatchObject({
      completedSessions: 3,
      interruptedSessions: 1,
      totalFocusTime: 3 * 1500,
      totalBreakTime: 1500,
      longestStreak: 2,
    });
    expect(await services.history.forPeriod(TODAY, TODAY)).toHaveLength(1);
  });

  it('files a session under the day it started', async () => {
    await services.sessions.add(session('yesterday', 24 * 60, CompletionStatus.COMPLETED));
    expect((await services.history.byDate('2026-03-09'))?.completedSessions).toBe(1);
    expect((await services.history.today()).sessions).toEqual([]);
  });
});

describe('plans', () => {
  it('finalizes plans left active by a crash so they become resumable', async () => {
    const startedAt = NOW.getTime() - 20 * 60_000;
    const orphan: SessionPlan = {
      id: 'orphan',
      createdAt: startedAt,
      status: 'active',
      currentSegmentIndex: 0,
      settings: { focusDuration: 25, shortBreakDuration: 5 },
      segments: [
        {
          id: 's0',
          index: 0,
          type: SessionType.FOCUS,
          plannedDuration: 1500,
          actualDuration: null,
          expectedStartTime: startedAt,
          expectedEndTime: startedAt + 1_500_000,
          actualStartTime: startedAt,
          actualEndTime: null,
          status: 'in_progress',
          pausedTime: 0,
          elapsedAtLastUpdate: 590,
        },
      ],
      expectedEndTime: startedAt + 1_500_000,
      actualEndTime: null,
      interruptedAt: null,
      totalPlannedDuration: 1500,
      totalElapsed: 0,
      // Last snapshot 10 minutes in
      lastUpdated: startedAt + 600_000,
    };
    await services.plans.save(orphan);

    const reconciled = await services.plans.reconcileOrphans();
    expect(reconciled.map((p) => p.id)).toEqual(['orphan']);

    const [saved] = await services.plans.forDate(TODAY);
    expect(saved.status).toBe('interrupted');
    expect(saved.segments[0]).toMatchObject({ status: 'interrupted', actualDuration: 600 });
    expect(saved.totalElapsed).toBe(600);
    expect(await services.plans.reconcileOrphans()).toEqual([]);
  });
});

describe('lifetime stats', () => {
  it('recalculates across days and caches the result', async () => {
    expect((await services.stats.recalculate()).totalDaysActive).toBe(0);

    await services.sessions.add(session('today', 60, CompletionStatus.COMPLETED));
    await services.sessions.add(session('yesterday', 24 * 60, CompletionStatus.COMPLETED));

    const stats = await services.stats.recalculate();
    expect(stats).toMatchObject({ totalDaysActive: 2, totalSessions: 2, currentDayStreak: 2 });
    expect((await services.stats.get()).totalSessions).toBe(2);
  });
});

describe('challenges', () => {
  it('tracks days, streaks and completion', async () => {
    const created = await services.challenges.create({
      name: '3 days',
      startDate: '2026-03-07',
      endDate: '2026-03-09',
      durationDays: 3,
      status: ChallengeStatus.ACTIVE,
      days: createChallengeDays('2026-03-07', '2026-03-09'),
    });

    for (const date of ['2026-03-07', '2026-03-08', '2026-03-09']) {
      await services.challenges.markDay(created.id, date, ChallengeDayStatus.COMPLETED);
    }
    const done = await services.challenges.byId(created.id);
    expect(done).toMatchObject({ completedDays: 3, currentStreak: 3, longestStreak: 3 });
    // Past its end date with every day marked: finished
    expect(done?.status).toBe(ChallengeStatus.COMPLETED);
    // A date outside the challenge changes nothing
    expect(
      await services.challenges.markDay(created.id, '2027-01-01', ChallengeDayStatus.FAILED),
    ).toBeNull();

    await services.challenges.remove(created.id);
    expect(await services.challenges.list()).toEqual([]);
  });
});
