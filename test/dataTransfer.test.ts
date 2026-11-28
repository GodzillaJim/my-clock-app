// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../electron/main/database/migrationRunner';
import {
  DATA_TABLES,
  exportData,
  importData,
  listBackups,
  restoreBackup,
} from '../electron/main/database/dataTransfer';
import * as sessionRepo from '../electron/main/database/repositories/sessionRepo';
import * as planRepo from '../electron/main/database/repositories/planRepo';
import * as challengeRepo from '../electron/main/database/repositories/challengeRepo';
import * as kvRepo from '../electron/main/database/repositories/kvRepo';
import * as snapshotRepo from '../electron/main/database/repositories/snapshotRepo';
import {
  ChallengeDayStatus,
  ChallengeStatus,
  CompletionStatus,
  SessionType,
  type SessionPlan,
} from '../src/features/timer/types';

const T = Date.parse('2026-03-10T09:00:00Z');
let dir: string;
let dirs: { scratch: string; backups: string };
const databases: Database.Database[] = [];

function freshDb(name: string) {
  const db = new Database(path.join(dir, name));
  migrate(db, null);
  databases.push(db);
  return db;
}

const plan: SessionPlan = {
  id: 'p1',
  createdAt: T,
  status: 'completed',
  currentSegmentIndex: 0,
  settings: { focusDuration: 25, shortBreakDuration: 5 },
  segments: [
    {
      id: 'seg1',
      index: 0,
      type: SessionType.FOCUS,
      plannedDuration: 1500,
      actualDuration: 1500,
      expectedStartTime: T,
      expectedEndTime: T + 1_500_000,
      actualStartTime: T,
      actualEndTime: T + 1_500_000,
      status: 'completed',
      pausedTime: 0,
      elapsedAtLastUpdate: 1500,
    },
  ],
  expectedEndTime: T + 1_500_000,
  actualEndTime: T + 1_500_000,
  interruptedAt: null,
  totalPlannedDuration: 1500,
  totalElapsed: 1500,
  lastUpdated: T + 1_500_000,
};

function seed(db: Database.Database, sessionId = 's1') {
  sessionRepo.insert(db, {
    id: sessionId,
    type: SessionType.FOCUS,
    sessionNumber: 1,
    plannedDuration: 1500,
    actualDuration: 1500,
    // Recent, so retention keeps it
    startTime: new Date(Date.now() - 3_600_000),
    endTime: new Date(Date.now() - 2_100_000),
    pausedTime: 0,
    completionStatus: CompletionStatus.COMPLETED,
    remainingTime: 0,
  });
  planRepo.saveWithSegments(db, { ...plan, createdAt: Date.now() - 3_600_000 });
  challengeRepo.saveWithDays(db, {
    id: 'c1',
    name: 'Daily focus',
    description: 'with a note',
    startDate: '2026-03-08',
    endDate: '2026-03-14',
    durationDays: 7,
    status: ChallengeStatus.ACTIVE,
    days: [{ date: '2026-03-08', status: ChallengeDayStatus.COMPLETED, note: 'done' }],
    createdAt: new Date(T),
    updatedAt: new Date(T),
    completedDays: 1,
    failedDays: 0,
    currentStreak: 1,
    longestStreak: 1,
  });
  kvRepo.set(db, 'app_state', { settings: { focusDuration: 40 } } as never);
}

const tablesOf = (db: Database.Database) => exportData(db, 'test').tables;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-transfer-'));
  dirs = { scratch: path.join(dir, 'scratch'), backups: path.join(dir, 'backups') };
});

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('export and import', () => {
  it('round-trips every table exactly', () => {
    const source = freshDb('source.db');
    seed(source);
    const file = exportData(source, '1.2.3', T);
    expect(file).toMatchObject({
      format: 'focus-sessions-export',
      schemaVersion: 1,
      appVersion: '1.2.3',
    });
    expect(Object.keys(file.tables).sort()).toEqual([...DATA_TABLES].sort());

    const target = freshDb('target.db');
    const result = importData(target, JSON.stringify(file), dirs, T);

    expect(tablesOf(target)).toEqual(file.tables);
    expect(result.counts).toMatchObject({ sessions: 1, session_plans: 1, challenges: 1 });
    expect(fs.readdirSync(dirs.scratch)).toEqual([]); // scratch file cleaned up
  });

  it('replaces the existing data, backing it up first', () => {
    const source = freshDb('source.db');
    seed(source, 'from-export');
    const target = freshDb('target.db');
    seed(target, 'already-here');
    snapshotRepo.save(target, plan);

    const { backup } = importData(target, JSON.stringify(exportData(source, 't')), dirs, T);

    expect(sessionRepo.getHistory(target).map((s) => s.id)).toEqual(['from-export']);
    expect(snapshotRepo.load(target)).toBeNull(); // no recovery offer from the old data
    const old = new Database(backup, { readonly: true });
    expect(sessionRepo.getHistory(old).map((s) => s.id)).toEqual(['already-here']);
    old.close();
  });

  const rejects = (json: string, message: RegExp) => {
    const target = freshDb('target.db');
    seed(target, 'keep-me');
    const before = tablesOf(target);
    expect(() => importData(target, json, dirs, T)).toThrow(message);
    expect(tablesOf(target)).toEqual(before);
    expect(listBackups(dirs.backups)).toEqual([]);
  };

  it('rejects files that are not exports, without changing anything', () => {
    rejects('not json', /not valid JSON/);
    rejects(JSON.stringify({ hello: 'world' }), /not a Focus Sessions export/);
  });

  it('rejects exports from a newer app version', () => {
    const file = { ...exportData(freshDb('s.db'), 't'), schemaVersion: 99 };
    rejects(JSON.stringify(file), /newer version/);
  });

  it('rejects unknown fields and invalid values, applying nothing', () => {
    const source = freshDb('source.db');
    seed(source);
    const file = exportData(source, 't');

    const extraField = structuredClone(file);
    extraField.tables.sessions[0].evil = 'x';
    rejects(JSON.stringify(extraField), /Unexpected field "evil" in sessions/);

    // The second table is broken: the first must not have been applied either
    const badValue = structuredClone(file);
    badValue.tables.sessions[0].type = 'nap';
    rejects(JSON.stringify(badValue), /invalid data/);
  });
});

describe('backups', () => {
  it('lists backups and restores one, backing up the current data first', () => {
    const db = freshDb('focus-sessions.db');
    seed(db, 'before');
    const before = tablesOf(db);
    importData(db, JSON.stringify(exportData(freshDb('other.db'), 't')), dirs, T); // empties the data
    expect(sessionRepo.getHistory(db)).toEqual([]);

    const [preImport] = listBackups(dirs.backups);
    expect(preImport.name).toMatch(/^focus-sessions\.pre-import\./);

    const { backup } = restoreBackup(db, preImport.name, dirs, T + 1000);
    expect(tablesOf(db)).toEqual(before);
    expect(path.basename(backup)).toMatch(/^focus-sessions\.pre-restore\./);
    expect(listBackups(dirs.backups)).toHaveLength(2);
  });

  it('only restores backups that exist in the backup folder', () => {
    const db = freshDb('focus-sessions.db');
    for (const name of ['../focus-sessions.db', 'focus-sessions.v1.nope.db', 'anything.db']) {
      expect(() => restoreBackup(db, name, dirs, T)).toThrow(/does not exist/);
    }
  });
});
