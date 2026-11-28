// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUPS_TO_KEEP,
  LATEST_VERSION,
  MIGRATIONS,
  backupDatabase,
  migrate,
  schemaVersion,
  type Migration,
} from '../electron/main/database/migrationRunner';
import * as sessionRepo from '../electron/main/database/repositories/sessionRepo';
import * as planRepo from '../electron/main/database/repositories/planRepo';
import * as dailyHistoryRepo from '../electron/main/database/repositories/dailyHistoryRepo';
import * as challengeRepo from '../electron/main/database/repositories/challengeRepo';
import * as kvRepo from '../electron/main/database/repositories/kvRepo';

const DAY = '2026-03-10';
const T = Date.parse(`${DAY}T09:00:00Z`);

/**
 * Data as each released schema version stored it, written with raw SQL so the
 * fixtures don't change when the repositories do. Every released version needs
 * one: adding migration N means adding FIXTURES[N].
 */
const FIXTURES: Record<number, (db: Database.Database) => void> = {
  1: (db) => {
    db.prepare(
      `INSERT INTO sessions (id, type, session_number, planned_duration, actual_duration, start_time,
        end_time, paused_time, completion_status, remaining_time, plan_id, created_date)
       VALUES ('s1', 'focus', 1, 1500, 1500, ?, ?, 0, 'completed', 0, NULL, ?)`,
    ).run(new Date(T).toISOString(), new Date(T + 1_500_000).toISOString(), DAY);
    db.prepare(
      `INSERT INTO session_plans (id, created_at, status, current_segment_index, settings,
        expected_end_time, actual_end_time, interrupted_at, total_planned_duration, total_elapsed, last_updated)
       VALUES ('p1', ?, 'completed', 0, '{"focusDuration":25,"shortBreakDuration":5}', ?, ?, NULL, 1500, 1500, ?)`,
    ).run(T, T + 1_500_000, T + 1_500_000, T + 1_500_000);
    db.prepare(
      `INSERT INTO plan_segments (id, plan_id, idx, type, planned_duration, actual_duration,
        expected_start_time, expected_end_time, actual_start_time, actual_end_time, status, paused_time, elapsed_at_last_update)
       VALUES ('seg1', 'p1', 0, 'focus', 1500, 1500, ?, ?, ?, ?, 'completed', 0, 1500)`,
    ).run(T, T + 1_500_000, T, T + 1_500_000);
    db.prepare(
      `INSERT INTO daily_history (date, total_focus_time, total_break_time, completed_sessions,
        interrupted_sessions, skipped_sessions, average_session_length, longest_streak, created_at,
        updated_at, day_start_time, day_end_time, session_plan_ids, total_planned_time, total_actual_time, completion_rate)
       VALUES (?, 1500, 0, 1, 0, 0, 1500, 1, ?, ?, ?, ?, '["p1"]', 1500, 1500, 1)`,
    ).run(DAY, new Date(T).toISOString(), new Date(T).toISOString(), T, T + 1_500_000);
    db.prepare(
      `INSERT INTO challenges (id, name, description, start_date, end_date, duration_days, status,
        created_at, updated_at, completed_days, failed_days, current_streak, longest_streak)
       VALUES ('c1', '7 days', NULL, '2026-03-08', '2026-03-14', 7, 'active', ?, ?, 1, 0, 1, 1)`,
    ).run(new Date(T).toISOString(), new Date(T).toISOString());
    db.prepare(
      `INSERT INTO challenge_days (challenge_id, date, status, note, marked_at)
       VALUES ('c1', '2026-03-08', 'completed', 'done', ?)`,
    ).run(new Date(T).toISOString());
    db.prepare('INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
      'app_state',
      JSON.stringify({ settings: { focusDuration: 40 } }),
      T,
    );
  },
};

/** After upgrading, every fixture row reads back through the current repositories. */
function expectFixtureData(db: Database.Database) {
  expect(sessionRepo.getByDate(db, DAY)).toEqual([
    expect.objectContaining({ id: 's1', type: 'focus', completionStatus: 'completed' }),
  ]);
  expect(planRepo.get(db, 'p1')).toMatchObject({
    status: 'completed',
    segments: [expect.objectContaining({ id: 'seg1', status: 'completed', actualDuration: 1500 })],
  });
  expect(dailyHistoryRepo.getByDate(db, DAY)).toMatchObject({
    completedSessions: 1,
    sessionPlanIds: ['p1'],
  });
  expect(challengeRepo.getById(db, 'c1')).toMatchObject({
    name: '7 days',
    days: [expect.objectContaining({ date: '2026-03-08', status: 'completed', note: 'done' })],
  });
  expect(kvRepo.get(db, 'app_state')).toEqual({ settings: { focusDuration: 40 } });
}

let dir: string;
let backups: string;
const open = (name = 'focus-sessions.db') => new Database(path.join(dir, name));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-migrations-'));
  backups = path.join(dir, 'backups');
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('schema migrations', () => {
  it('has a fixture for every released schema version', () => {
    for (const m of MIGRATIONS) expect(FIXTURES[m.version], `fixture v${m.version}`).toBeDefined();
  });

  it('creates the latest schema in a new database, without a backup', () => {
    const db = open();
    const result = migrate(db, backups);
    expect(result).toMatchObject({ from: 0, to: LATEST_VERSION, backup: null });
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expect(fs.existsSync(backups)).toBe(false);
    db.close();
  });

  // Every version a user might still have, upgraded to the latest
  for (const from of MIGRATIONS.map((m) => m.version)) {
    it(`upgrades a v${from} database with data to v${LATEST_VERSION}, keeping the data`, () => {
      const db = open();
      migrate(
        db,
        backups,
        T,
        MIGRATIONS.filter((m) => m.version <= from),
      );
      FIXTURES[from](db);

      const result = migrate(db, backups, T);
      expect(result.to).toBe(LATEST_VERSION);
      expect(schemaVersion(db)).toBe(LATEST_VERSION);
      expectFixtureData(db);
      db.close();
    });
  }

  it('does nothing when the database is up to date', () => {
    const db = open();
    migrate(db, backups);
    expect(migrate(db, backups)).toMatchObject({ applied: [], backup: null, newerThanApp: false });
    db.close();
  });

  it('flags a database written by a newer app version and leaves it alone', () => {
    const db = open();
    migrate(db, backups);
    db.prepare('INSERT INTO schema_version (version, description) VALUES (99, ?)').run('future');
    expect(migrate(db, backups)).toMatchObject({
      from: 99,
      to: 99,
      applied: [],
      newerThanApp: true,
    });
    db.close();
  });
});

describe('backups and failures', () => {
  const addNotes: Migration = {
    version: LATEST_VERSION + 1,
    description: 'test: add notes',
    up: (db) => db.exec('ALTER TABLE sessions ADD COLUMN notes TEXT'),
  };

  it('backs up an existing database before migrating it', () => {
    const db = open();
    migrate(db, backups, T);
    FIXTURES[LATEST_VERSION](db);

    const result = migrate(db, backups, T + 1000, [...MIGRATIONS, addNotes]);
    expect(result.applied).toEqual([addNotes.version]);
    expect(result.backup).toMatch(new RegExp(`focus-sessions\\.v${LATEST_VERSION}\\..*\\.db$`));

    // The backup is the database as it was before the migration
    const copy = new Database(result.backup!, { readonly: true });
    expect(schemaVersion(copy)).toBe(LATEST_VERSION);
    expectFixtureData(copy);
    const columns = copy.prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
    expect(columns.map((c) => c.name)).not.toContain('notes');
    copy.close();
    db.close();
  });

  it('rolls back a failing migration, leaving the data and version untouched', () => {
    const db = open();
    migrate(db, backups, T);
    FIXTURES[LATEST_VERSION](db);
    const broken: Migration = {
      version: LATEST_VERSION + 1,
      description: 'test: fails halfway',
      up: (d) => {
        d.exec('CREATE TABLE half_done (x INTEGER)');
        d.exec('DELETE FROM sessions');
        throw new Error('migration bug');
      },
    };

    expect(() => migrate(db, backups, T + 1000, [...MIGRATIONS, broken])).toThrow('migration bug');
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expectFixtureData(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).not.toContain('half_done');
    // ...and a backup was taken before trying
    expect(fs.readdirSync(backups)).toHaveLength(1);
    db.close();
  });

  it(`keeps only the newest ${BACKUPS_TO_KEEP} backups`, () => {
    const db = open();
    migrate(db, backups);
    const made = Array.from({ length: BACKUPS_TO_KEEP + 2 }, (_, i) =>
      path.basename(backupDatabase(db, backups, 'v1', T + i * 60_000)),
    );
    const kept = fs.readdirSync(backups).sort();
    expect(kept).toHaveLength(BACKUPS_TO_KEEP);
    expect(kept).toEqual(made.slice(-BACKUPS_TO_KEEP).sort());
    db.close();
  });
});
