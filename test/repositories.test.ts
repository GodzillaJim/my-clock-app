// @vitest-environment node
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { up as createSchema } from '../electron/main/database/migrations/001_initial_schema';
import * as sessionRepo from '../electron/main/database/repositories/sessionRepo';
import * as planRepo from '../electron/main/database/repositories/planRepo';
import * as kvRepo from '../electron/main/database/repositories/kvRepo';
import {
  CompletionStatus,
  SessionType,
  type SessionPlan,
  type SessionRecord,
} from '../src/features/timer/types';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  createSchema(db);
});

afterEach(() => db.close());

const now = Date.now();

const session: SessionRecord = {
  id: 's1',
  type: SessionType.FOCUS,
  sessionNumber: 1,
  plannedDuration: 1500,
  actualDuration: 1490,
  startTime: new Date(now - 1_500_000),
  endTime: new Date(now),
  pausedTime: 0,
  completionStatus: CompletionStatus.COMPLETED,
  remainingTime: 0,
};

const plan: SessionPlan = {
  id: 'p1',
  createdAt: now,
  status: 'active',
  segments: [
    {
      id: 'seg1',
      index: 0,
      type: SessionType.FOCUS,
      plannedDuration: 1500,
      actualDuration: 0,
      expectedStartTime: now,
      expectedEndTime: now + 1_500_000,
      actualStartTime: now,
      actualEndTime: null,
      status: 'in_progress',
      pausedTime: 0,
      elapsedAtLastUpdate: 0,
    },
  ],
  currentSegmentIndex: 0,
  settings: { focusDuration: 25, shortBreakDuration: 5 },
  expectedEndTime: now + 1_500_000,
  actualEndTime: null,
  interruptedAt: null,
  totalPlannedDuration: 1500,
  totalElapsed: 0,
  lastUpdated: now,
};

describe('sessionRepo', () => {
  it('round-trips a session with the domain enum values', () => {
    sessionRepo.insert(db, session);
    const [stored] = sessionRepo.getHistory(db);
    // Regression: these used to come back as 'FOCUS' / 'COMPLETED', which
    // never matched SessionType.FOCUS / CompletionStatus.COMPLETED
    expect(stored.type).toBe(SessionType.FOCUS);
    expect(stored.completionStatus).toBe(CompletionStatus.COMPLETED);
    expect(stored).toEqual(session);
  });
});

describe('planRepo', () => {
  it('round-trips a plan, keeping zero durations and segment types', () => {
    planRepo.saveWithSegments(db, plan);
    const stored = planRepo.get(db, 'p1');
    expect(stored).toEqual(plan);
    expect(stored?.segments[0].type).toBe(SessionType.FOCUS);
    expect(stored?.segments[0].actualDuration).toBe(0);
  });

  it('applies partial updates', () => {
    planRepo.saveWithSegments(db, plan);
    const updated = planRepo.update(db, 'p1', { status: 'completed', totalElapsed: 1500 });
    expect(updated?.status).toBe('completed');
    expect(updated?.totalElapsed).toBe(1500);
    expect(updated?.segments).toEqual(plan.segments);
    expect(planRepo.update(db, 'missing', { status: 'completed' })).toBeNull();
  });
});

describe('kvRepo', () => {
  it('stores JSON documents by key', () => {
    expect(kvRepo.get(db, 'lifetime_stats')).toBeNull();
    kvRepo.set(db, 'app_state', { version: '1.0.0' } as never);
    expect(kvRepo.get(db, 'app_state')).toEqual({ version: '1.0.0' });
  });
});
