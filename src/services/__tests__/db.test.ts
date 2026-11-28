import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '../db';
import { createPersistenceService } from '../persistenceService';
import {
  ChallengeStatus,
  CompletionStatus,
  SessionType,
  type Challenge,
  type DailyHistory,
  type SessionPlan,
  type SessionRecord,
} from '@/features/timer/types';

const session = (id: string, start: string): SessionRecord => ({
  id,
  type: SessionType.FOCUS,
  sessionNumber: 1,
  plannedDuration: 60,
  actualDuration: 60,
  startTime: new Date(start),
  endTime: new Date(new Date(start).getTime() + 60_000),
  pausedTime: 0,
  completionStatus: CompletionStatus.COMPLETED,
  remainingTime: 0,
});

const plan = (id: string, createdAt: number): SessionPlan => ({
  id,
  createdAt,
  status: 'active',
  segments: [],
  currentSegmentIndex: 0,
  settings: { focusDuration: 25, shortBreakDuration: 5 },
  expectedEndTime: createdAt,
  actualEndTime: null,
  interruptedAt: null,
  totalPlannedDuration: 0,
  totalElapsed: 0,
  lastUpdated: createdAt,
});

const history = (date: string): DailyHistory => ({
  date,
  sessions: [session('embedded', `${date}T10:00:00Z`)],
  totalFocusTime: 60,
  totalBreakTime: 0,
  completedSessions: 1,
  interruptedSessions: 0,
  skippedSessions: 0,
  averageSessionLength: 60,
  longestStreak: 1,
  createdAt: new Date(`${date}T10:00:00Z`),
  updatedAt: new Date(`${date}T10:00:00Z`),
  dayStartTime: null,
  dayEndTime: null,
  sessionPlanIds: [],
  totalPlannedTime: 0,
  totalActualTime: 0,
  completionRate: 1,
});

describe('in-memory FocusDb', () => {
  it('finds sessions by (UTC) start date and lists history newest first', async () => {
    const db = createMemoryDb();
    await db.sessions.save(session('b', '2026-03-02T09:00:00Z'));
    await db.sessions.save(session('a', '2026-03-02T08:00:00Z'));
    await db.sessions.save(session('c', '2026-03-03T08:00:00Z'));

    expect((await db.sessions.getByDate('2026-03-02')).map((s) => s.id)).toEqual(['a', 'b']);
    expect((await db.sessions.getHistory()).map((s) => s.id)).toEqual(['c', 'b', 'a']);
    expect((await db.sessions.getHistory(1)).map((s) => s.id)).toEqual(['c']);

    await db.sessions.delete('c');
    expect(await db.sessions.getByDate('2026-03-03')).toEqual([]);
  });

  it('returns copies, like values that crossed IPC', async () => {
    const db = createMemoryDb();
    await db.sessions.save(session('a', '2026-03-02T08:00:00Z'));
    const [stored] = await db.sessions.getHistory();
    stored.actualDuration = 999;
    expect((await db.sessions.getHistory())[0].actualDuration).toBe(60);
    expect((await db.sessions.getHistory())[0].startTime).toBeInstanceOf(Date);
  });

  it('queries plans by local date range and merges updates', async () => {
    const db = createMemoryDb();
    const day = new Date('2026-03-02T12:00:00').getTime();
    await db.plans.save(plan('late', day + 1000));
    await db.plans.save(plan('early', day));
    await db.plans.save(plan('other-day', day + 86_400_000));

    expect((await db.plans.getByDate('2026-03-02')).map((p) => p.id)).toEqual(['early', 'late']);
    expect(await db.plans.getByDateRange('2026-03-02', '2026-03-03')).toHaveLength(3);

    const updated = await db.plans.update('early', { status: 'completed' });
    expect(updated).toMatchObject({ id: 'early', status: 'completed' });
    expect((await db.plans.get('early'))?.status).toBe('completed');
    expect(await db.plans.update('missing', { status: 'completed' })).toBeNull();
    expect(await db.plans.get('missing')).toBeNull();
  });

  it('stores history without embedded sessions, and clears a day with its sessions', async () => {
    const db = createMemoryDb();
    await db.history.save(history('2026-03-01'));
    await db.history.save(history('2026-03-02'));
    await db.sessions.save(session('s', '2026-03-02T08:00:00Z'));

    expect((await db.history.getByDate('2026-03-02'))?.sessions).toEqual([]);
    expect(await db.history.getAllDates()).toEqual(['2026-03-02', '2026-03-01']);
    expect((await db.history.getByRange('2026-03-01', '2026-03-02')).map((h) => h.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
    ]);

    await db.history.clearToday('2026-03-02');
    expect(await db.history.getByDate('2026-03-02')).toBeNull();
    expect(await db.sessions.getByDate('2026-03-02')).toEqual([]);
    expect(await db.history.getByDate('2026-03-01')).not.toBeNull();

    await db.history.resetAll();
    expect(await db.history.getAllDates()).toEqual([]);
  });

  it('keeps challenges newest first', async () => {
    const db = createMemoryDb();
    const challenge = (id: string, createdAt: string): Challenge => ({
      id,
      name: id,
      startDate: '2026-03-01',
      endDate: '2026-03-07',
      durationDays: 7,
      status: ChallengeStatus.ACTIVE,
      days: [],
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
      completedDays: 0,
      failedDays: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
    await db.challenges.save(challenge('old', '2026-03-01T00:00:00Z'));
    await db.challenges.save(challenge('new', '2026-03-05T00:00:00Z'));
    expect((await db.challenges.getAll()).map((c) => c.id)).toEqual(['new', 'old']);
    expect((await db.challenges.getById('old'))?.name).toBe('old');
    await db.challenges.delete('old');
    expect(await db.challenges.getById('old')).toBeNull();
  });

  it('stores key-value documents and the plan snapshot', async () => {
    const db = createMemoryDb();
    expect(await db.kv.get('app_state')).toBeNull();
    await db.kv.set('lifetime_stats', { totalSessions: 3 } as never);
    expect(await db.kv.get('lifetime_stats')).toEqual({ totalSessions: 3 });

    const persistence = createPersistenceService(db);
    expect(await persistence.loadPlanSnapshot()).toBeNull();
    persistence.savePlanSnapshot(plan('p', 1));
    await Promise.resolve();
    expect((await persistence.loadPlanSnapshot())?.plan.id).toBe('p');
    persistence.clearPlanSnapshot();
    await Promise.resolve();
    expect(await persistence.loadPlanSnapshot()).toBeNull();
  });
});
