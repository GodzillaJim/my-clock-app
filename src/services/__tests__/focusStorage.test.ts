import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb, type FocusDb } from '../db';
import { FocusStorageService } from '../focusStorage';
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
let storage: FocusStorageService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  db = createMemoryDb();
  storage = new FocusStorageService(db);
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

describe('FocusStorageService', () => {
  it('returns default app state, then merges saved settings over the defaults', async () => {
    expect((await storage.getAppState()).settings).toEqual(DEFAULT_SETTINGS);

    const state = await storage.getAppState();
    await storage.saveAppState({
      ...state,
      settings: { ...state.settings, focusDuration: 40 },
    });
    // A stored state from an older version lacks newer settings; defaults fill them in
    const stored = await db.kv.get('app_state');
    const { enableTickSound: _dropped, ...olderSettings } = stored!.settings;
    await db.kv.set('app_state', { ...stored!, settings: olderSettings as never });

    const loaded = await storage.getAppState();
    expect(loaded.settings.focusDuration).toBe(40);
    expect(loaded.settings.enableTickSound).toBe(DEFAULT_SETTINGS.enableTickSound);
  });

  it('updates the day summary whenever a session is saved', async () => {
    await storage.addSession(session('a', 120, CompletionStatus.COMPLETED));
    await storage.addSession(session('b', 60, CompletionStatus.COMPLETED));
    await storage.addSession(session('c', 30, CompletionStatus.INTERRUPTED));
    await storage.addSession(session('d', 10, CompletionStatus.COMPLETED, SessionType.SHORT_BREAK));

    const today = await storage.getTodayHistory();
    expect(today.date).toBe(TODAY);
    expect(today.sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(today.completedSessions).toBe(3);
    expect(today.interruptedSessions).toBe(1);
    expect(today.totalFocusTime).toBe(3 * 1500);
    expect(today.totalBreakTime).toBe(1500);
    expect(today.longestStreak).toBe(2);
  });

  it('computes session stats from stored sessions', async () => {
    await storage.addSession(session('a', 120, CompletionStatus.COMPLETED));
    await storage.addSession(session('b', 60, CompletionStatus.COMPLETED));
    const stats = await storage.getSessionStats();
    expect(stats.completedSessions).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.totalFocusTime).toBe('50m');
  });

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
    await storage.saveSessionPlan(orphan);

    const reconciled = await storage.reconcileOrphanedPlans();
    expect(reconciled.map((p) => p.id)).toEqual(['orphan']);

    const saved = await storage.getSessionPlan('orphan');
    expect(saved?.status).toBe('interrupted');
    expect(saved?.segments[0]).toMatchObject({ status: 'interrupted', actualDuration: 600 });
    expect(await storage.reconcileOrphanedPlans()).toEqual([]);
  });

  it('recalculates lifetime stats across days', async () => {
    expect((await storage.recalculateLifetimeStats()).totalDaysActive).toBe(0);

    await storage.addSession(session('a', 60, CompletionStatus.COMPLETED));
    await storage.addSession(session('yesterday', 24 * 60, CompletionStatus.COMPLETED));
    await storage.updateDailyStats('2026-03-09');

    const stats = await storage.recalculateLifetimeStats();
    expect(stats.totalDaysActive).toBe(2);
    expect(stats.totalSessions).toBe(2);
    expect(stats.currentDayStreak).toBe(2);
    expect((await storage.getLifetimeStats()).totalSessions).toBe(2);
  });

  it('clears today and resets all history', async () => {
    await storage.addSession(session('a', 60, CompletionStatus.COMPLETED));
    await storage.clearTodayHistory();
    expect((await storage.getTodayHistory()).sessions).toEqual([]);

    await storage.addSession(session('b', 60, CompletionStatus.COMPLETED));
    await storage.resetAllHistory();
    expect(await storage.getAllHistoryDates()).toEqual([]);
    expect(await storage.getSessionHistory()).toEqual([]);
  });

  it('tracks challenge days, streaks and completion', async () => {
    const created = await storage.createChallenge({
      name: '3 days',
      startDate: '2026-03-07',
      endDate: '2026-03-09',
      durationDays: 3,
      status: ChallengeStatus.ACTIVE,
      days: createChallengeDays('2026-03-07', '2026-03-09'),
    });

    for (const date of ['2026-03-07', '2026-03-08', '2026-03-09']) {
      await storage.markChallengeDay(created.id, date, ChallengeDayStatus.COMPLETED);
    }
    const done = await storage.getChallengeById(created.id);
    expect(done).toMatchObject({ completedDays: 3, currentStreak: 3, longestStreak: 3 });
    // Past its end date with every day marked: finished
    expect(done?.status).toBe(ChallengeStatus.COMPLETED);
    expect(await storage.getActiveChallenges()).toEqual([]);

    await storage.deleteChallenge(created.id);
    expect(await storage.getChallenges()).toEqual([]);
  });
});
