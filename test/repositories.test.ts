// @vitest-environment node
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../electron/main/database/migrationRunner';
import { RETENTION_DAYS } from '../electron/main/database/retention';
import * as sessionRepo from '../electron/main/database/repositories/sessionRepo';
import * as planRepo from '../electron/main/database/repositories/planRepo';
import * as dailyHistoryRepo from '../electron/main/database/repositories/dailyHistoryRepo';
import * as challengeRepo from '../electron/main/database/repositories/challengeRepo';
import * as kvRepo from '../electron/main/database/repositories/kvRepo';
import * as snapshotRepo from '../electron/main/database/repositories/snapshotRepo';
import {
  ChallengeDayStatus,
  ChallengeStatus,
  CompletionStatus,
  SessionType,
  type Challenge,
  type DailyHistory,
  type SessionPlan,
  type SessionRecord,
} from '../src/features/timer/types';

// Mid-day UTC, so local and UTC dates agree in any time zone the tests run in
const NOW = Date.parse('2026-03-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const TODAY = '2026-03-10';

let db: Database.Database;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  db = new Database(':memory:');
  migrate(db, null);
});

afterEach(() => {
  db.close();
  vi.useRealTimers();
});

const session = (id: string, start: number, extra: Partial<SessionRecord> = {}): SessionRecord => ({
  id,
  type: SessionType.FOCUS,
  sessionNumber: 1,
  plannedDuration: 1500,
  actualDuration: 1490,
  startTime: new Date(start),
  endTime: new Date(start + 1_500_000),
  pausedTime: 0,
  completionStatus: CompletionStatus.COMPLETED,
  remainingTime: 0,
  ...extra,
});

const plan = (id: string, createdAt: number, extra: Partial<SessionPlan> = {}): SessionPlan => ({
  id,
  createdAt,
  status: 'active',
  segments: [
    {
      id: `${id}-s0`,
      index: 0,
      type: SessionType.FOCUS,
      plannedDuration: 1500,
      actualDuration: 0,
      expectedStartTime: createdAt,
      expectedEndTime: createdAt + 1_500_000,
      actualStartTime: createdAt,
      actualEndTime: null,
      status: 'in_progress',
      pausedTime: 0,
      elapsedAtLastUpdate: 0,
    },
    {
      id: `${id}-s1`,
      index: 1,
      type: SessionType.SHORT_BREAK,
      plannedDuration: 300,
      actualDuration: null,
      expectedStartTime: createdAt + 1_500_000,
      expectedEndTime: createdAt + 1_800_000,
      actualStartTime: null,
      actualEndTime: null,
      status: 'pending',
      pausedTime: 0,
      elapsedAtLastUpdate: 0,
    },
  ],
  currentSegmentIndex: 0,
  settings: { focusDuration: 25, shortBreakDuration: 5 },
  expectedEndTime: createdAt + 1_800_000,
  actualEndTime: null,
  interruptedAt: null,
  totalPlannedDuration: 1800,
  totalElapsed: 0,
  lastUpdated: createdAt,
  ...extra,
});

const history = (date: string, extra: Partial<DailyHistory> = {}): DailyHistory => ({
  date,
  sessions: [],
  totalFocusTime: 3000,
  totalBreakTime: 300,
  completedSessions: 2,
  interruptedSessions: 1,
  skippedSessions: 0,
  averageSessionLength: 1100,
  longestStreak: 2,
  createdAt: new Date(`${date}T08:00:00Z`),
  updatedAt: new Date(`${date}T18:00:00Z`),
  dayStartTime: Date.parse(`${date}T08:00:00Z`),
  dayEndTime: Date.parse(`${date}T18:00:00Z`),
  sessionPlanIds: ['p1', 'p2'],
  totalPlannedTime: 3600,
  totalActualTime: 3300,
  completionRate: 0.75,
  ...extra,
});

const challenge = (id: string, createdAt: number, extra: Partial<Challenge> = {}): Challenge => ({
  id,
  name: `Challenge ${id}`,
  description: 'Focus every day',
  startDate: '2026-03-08',
  endDate: '2026-03-14',
  durationDays: 7,
  status: ChallengeStatus.ACTIVE,
  days: [
    {
      date: '2026-03-08',
      status: ChallengeDayStatus.COMPLETED,
      note: 'good',
      markedAt: new Date(NOW),
    },
    { date: '2026-03-09', status: ChallengeDayStatus.PENDING },
  ],
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
  completedDays: 1,
  failedDays: 0,
  currentStreak: 1,
  longestStreak: 1,
  ...extra,
});

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('sessionRepo', () => {
  it('round-trips a session with the domain enum values', () => {
    const s = session('s1', NOW - 3600_000);
    sessionRepo.insert(db, s);
    const [stored] = sessionRepo.getHistory(db);
    // Regression: these used to come back as 'FOCUS' / 'COMPLETED'
    expect(stored.type).toBe(SessionType.FOCUS);
    expect(stored.completionStatus).toBe(CompletionStatus.COMPLETED);
    expect(stored).toEqual(s);
  });

  it('keeps a session without an end time and replaces one saved again', () => {
    sessionRepo.insert(db, session('s1', NOW - 3600_000, { endTime: null }));
    expect(sessionRepo.getHistory(db)[0].endTime).toBeNull();
    sessionRepo.insert(db, session('s1', NOW - 3600_000, { actualDuration: 60 }));
    expect(sessionRepo.getHistory(db)).toHaveLength(1);
    expect(sessionRepo.getHistory(db)[0].actualDuration).toBe(60);
  });

  it('finds sessions by start date (oldest first) and history (newest first, with a limit)', () => {
    sessionRepo.insert(db, session('late', NOW - 1000));
    sessionRepo.insert(db, session('early', NOW - 3600_000));
    sessionRepo.insert(db, session('yesterday', NOW - DAY));

    expect(sessionRepo.getByDate(db, TODAY).map((s) => s.id)).toEqual(['early', 'late']);
    expect(sessionRepo.getHistory(db).map((s) => s.id)).toEqual(['late', 'early', 'yesterday']);
    expect(sessionRepo.getHistory(db, 2).map((s) => s.id)).toEqual(['late', 'early']);
  });

  it('deletes by id, by date and all', () => {
    sessionRepo.insert(db, session('a', NOW - 1000));
    sessionRepo.insert(db, session('b', NOW - 2000));
    sessionRepo.insert(db, session('old', NOW - DAY));

    sessionRepo.deleteById(db, 'a');
    expect(sessionRepo.getHistory(db).map((s) => s.id)).toEqual(['b', 'old']);
    sessionRepo.deleteByDate(db, TODAY);
    expect(sessionRepo.getHistory(db).map((s) => s.id)).toEqual(['old']);
    sessionRepo.deleteAll(db);
    expect(count('sessions')).toBe(0);
  });

  it(`prunes sessions older than ${RETENTION_DAYS} days on insert, keeping the boundary day`, () => {
    sessionRepo.insert(db, session('expired', NOW - (RETENTION_DAYS + 1) * DAY));
    sessionRepo.insert(db, session('boundary', NOW - RETENTION_DAYS * DAY));
    sessionRepo.insert(db, session('new', NOW));
    expect(sessionRepo.getHistory(db).map((s) => s.id)).toEqual(['new', 'boundary']);
  });
});

describe('planRepo', () => {
  it('round-trips a plan, keeping zero durations, nulls and segment types', () => {
    const p = plan('p1', NOW);
    planRepo.saveWithSegments(db, p);
    const stored = planRepo.get(db, 'p1');
    expect(stored).toEqual(p);
    expect(stored?.segments[0].actualDuration).toBe(0);
    expect(stored?.segments[1].actualDuration).toBeNull();
    expect(planRepo.get(db, 'missing')).toBeNull();
  });

  it('replaces the segments when a plan is saved again', () => {
    planRepo.saveWithSegments(db, plan('p1', NOW));
    planRepo.saveWithSegments(db, { ...plan('p1', NOW), segments: [plan('p1', NOW).segments[0]] });
    expect(planRepo.get(db, 'p1')?.segments).toHaveLength(1);
    expect(count('plan_segments')).toBe(1);
  });

  it('queries plans by local date range, oldest first', () => {
    planRepo.saveWithSegments(db, plan('later', NOW + 1000));
    planRepo.saveWithSegments(db, plan('first', NOW));
    planRepo.saveWithSegments(db, plan('tomorrow', NOW + DAY));
    expect(planRepo.getByDate(db, TODAY).map((p) => p.id)).toEqual(['first', 'later']);
    expect(planRepo.getByDateRange(db, TODAY, '2026-03-11').map((p) => p.id)).toEqual([
      'first',
      'later',
      'tomorrow',
    ]);
  });

  it('applies partial updates and refreshes lastUpdated', () => {
    planRepo.saveWithSegments(db, plan('p1', NOW - 1000));
    const updated = planRepo.update(db, 'p1', { status: 'completed', totalElapsed: 1800 });
    expect(updated).toMatchObject({ status: 'completed', totalElapsed: 1800, lastUpdated: NOW });
    expect(updated?.segments).toEqual(plan('p1', NOW - 1000).segments);
    expect(planRepo.update(db, 'missing', { status: 'completed' })).toBeNull();
  });

  it(`prunes plans older than ${RETENTION_DAYS} days together with their segments`, () => {
    planRepo.saveWithSegments(db, plan('expired', NOW - (RETENTION_DAYS + 1) * DAY));
    planRepo.saveWithSegments(db, plan('kept', NOW));
    expect(planRepo.get(db, 'expired')).toBeNull();
    expect(count('session_plans')).toBe(1);
    expect(count('plan_segments')).toBe(2);
  });
});

describe('dailyHistoryRepo', () => {
  it('round-trips a day; its sessions live in their own table', () => {
    dailyHistoryRepo.save(db, history(TODAY, { sessions: [session('s1', NOW)] }));
    expect(dailyHistoryRepo.getByDate(db, TODAY)).toEqual(history(TODAY));
    expect(dailyHistoryRepo.getByDate(db, '2026-03-11')).toBeNull();
  });

  it('keeps null day bounds and replaces a day saved again', () => {
    dailyHistoryRepo.save(db, history(TODAY, { dayStartTime: null, dayEndTime: null }));
    expect(dailyHistoryRepo.getByDate(db, TODAY)).toMatchObject({
      dayStartTime: null,
      dayEndTime: null,
    });
    dailyHistoryRepo.save(db, history(TODAY, { completedSessions: 9 }));
    expect(count('daily_history')).toBe(1);
    expect(dailyHistoryRepo.getByDate(db, TODAY)?.completedSessions).toBe(9);
  });

  it('lists days in a range (oldest first) and all dates (newest first)', () => {
    for (const date of ['2026-03-08', TODAY, '2026-03-09'])
      dailyHistoryRepo.save(db, history(date));
    expect(dailyHistoryRepo.getByRange(db, '2026-03-09', TODAY).map((d) => d.date)).toEqual([
      '2026-03-09',
      TODAY,
    ]);
    expect(dailyHistoryRepo.getAllDates(db)).toEqual([TODAY, '2026-03-09', '2026-03-08']);
  });

  it('deletes a day and all days', () => {
    dailyHistoryRepo.save(db, history('2026-03-09'));
    dailyHistoryRepo.save(db, history(TODAY));
    dailyHistoryRepo.deleteByDate(db, TODAY);
    expect(dailyHistoryRepo.getAllDates(db)).toEqual(['2026-03-09']);
    dailyHistoryRepo.deleteAll(db);
    expect(dailyHistoryRepo.getAllDates(db)).toEqual([]);
  });

  it(`prunes days older than ${RETENTION_DAYS} days on save`, () => {
    dailyHistoryRepo.save(db, history('2025-12-01'));
    dailyHistoryRepo.save(db, history(TODAY));
    expect(dailyHistoryRepo.getAllDates(db)).toEqual([TODAY]);
  });
});

describe('challengeRepo', () => {
  it('round-trips a challenge with its days, notes and marks', () => {
    const c = challenge('c1', NOW);
    challengeRepo.saveWithDays(db, c);
    expect(challengeRepo.getById(db, 'c1')).toEqual(c);
    expect(challengeRepo.getById(db, 'missing')).toBeNull();
  });

  it('stores a challenge without a description', () => {
    challengeRepo.saveWithDays(db, challenge('c1', NOW, { description: undefined }));
    expect(challengeRepo.getById(db, 'c1')?.description).toBeUndefined();
  });

  it('replaces the days when saved again, and lists newest first', () => {
    challengeRepo.saveWithDays(db, challenge('old', NOW - DAY));
    challengeRepo.saveWithDays(db, challenge('new', NOW));
    challengeRepo.saveWithDays(db, { ...challenge('new', NOW), days: [] });
    expect(challengeRepo.getAll(db).map((c) => [c.id, c.days.length])).toEqual([
      ['new', 0],
      ['old', 2],
    ]);
  });

  it('deletes a challenge with its days', () => {
    challengeRepo.saveWithDays(db, challenge('c1', NOW));
    challengeRepo.deleteById(db, 'c1');
    expect(challengeRepo.getAll(db)).toEqual([]);
    expect(count('challenge_days')).toBe(0);
  });
});

describe('kvRepo', () => {
  it('stores, overwrites and reads JSON documents by key', () => {
    expect(kvRepo.get(db, 'lifetime_stats')).toBeNull();
    kvRepo.set(db, 'app_state', { version: '1' } as never);
    kvRepo.set(db, 'app_state', { version: '2' } as never);
    expect(kvRepo.get(db, 'app_state')).toEqual({ version: '2' });
  });

  it('reads a corrupt document as missing', () => {
    db.prepare(
      "INSERT INTO kv_store (key, value, updated_at) VALUES ('app_state', '{oops', 0)",
    ).run();
    expect(kvRepo.get(db, 'app_state')).toBeNull();
  });
});

describe('snapshotRepo', () => {
  it('keeps one snapshot of the running plan, stamped with the save time', () => {
    expect(snapshotRepo.load(db)).toBeNull();
    snapshotRepo.save(db, plan('first', NOW));
    snapshotRepo.save(db, plan('second', NOW));
    expect(snapshotRepo.load(db)).toEqual({ plan: plan('second', NOW), lastUpdated: NOW });
    expect(count('active_snapshot')).toBe(1);
    snapshotRepo.clear(db);
    expect(snapshotRepo.load(db)).toBeNull();
  });

  it('reads a corrupt snapshot as missing', () => {
    db.prepare("INSERT INTO active_snapshot (id, plan, last_updated) VALUES (1, 'nope', 0)").run();
    expect(snapshotRepo.load(db)).toBeNull();
  });
});

describe('schema constraints', () => {
  it('rejects values outside the domain enums at the database level', () => {
    expect(() =>
      sessionRepo.insert(db, session('bad', NOW, { type: 'nap' as SessionType })),
    ).toThrow(/CHECK constraint/);
    expect(() =>
      challengeRepo.saveWithDays(db, challenge('bad', NOW, { status: 'won' as ChallengeStatus })),
    ).toThrow(/CHECK constraint/);
    // The failed challenge save left nothing behind (it runs in a transaction)
    expect(count('challenges')).toBe(0);
  });
});
