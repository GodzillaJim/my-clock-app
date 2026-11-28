/**
 * Schema migrations with a safety net: before an existing database is
 * migrated, a consistent copy is written to the backup folder (the last few
 * are kept). Each migration runs in its own transaction, so a failing one
 * leaves the database at the previous version.
 *
 * No Electron imports, so the whole upgrade path is tested against real SQLite.
 */
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { up as migration001 } from './migrations/001_initial_schema';

export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

/**
 * Every migration, in order. Append new ones; never edit or reorder released ones.
 * Each released version also needs a data fixture in test/migrations.test.ts, so the
 * upgrade from it is tested (the suite fails without one).
 */
export const MIGRATIONS: Migration[] = [
  { version: 1, description: 'Initial schema', up: migration001 },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** How many pre-migration backups to keep. */
export const BACKUPS_TO_KEEP = 5;

function ensureVersionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    );
  `);
}

/** The schema version of `db`; 0 for a new, empty database. */
export function schemaVersion(db: Database.Database): number {
  ensureVersionTable(db);
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
    version: number | null;
  };
  return row.version ?? 0;
}

/**
 * Writes a consistent copy of `db` (safe in WAL mode) into `dir` and deletes
 * all but the newest `keep` backups. Returns the new backup's path.
 */
export function backupDatabase(
  db: Database.Database,
  dir: string,
  label: string,
  now: number,
  keep = BACKUPS_TO_KEEP,
): string {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `focus-sessions.${label}.${stamp}.db`);
  db.prepare('VACUUM INTO ?').run(file);

  const backups = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('focus-sessions.') && name.endsWith('.db'))
    .map((name) => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time || b.name.localeCompare(a.name));
  for (const old of backups.slice(keep)) fs.rmSync(path.join(dir, old.name), { force: true });
  return file;
}

export interface MigrationResult {
  from: number;
  to: number;
  applied: number[];
  /** Set when an existing database was backed up first. */
  backup: string | null;
  /** The database was written by a newer app version than this one. */
  newerThanApp: boolean;
}

/**
 * Brings `db` up to the latest schema. An existing database (version > 0)
 * with pending migrations is backed up into `backupDir` first.
 * Throws if a migration fails; that migration is rolled back.
 */
export function migrate(
  db: Database.Database,
  backupDir: string,
  now = Date.now(),
  migrations: Migration[] = MIGRATIONS,
): MigrationResult {
  const from = schemaVersion(db);
  const pending = migrations.filter((m) => m.version > from);
  const latest = migrations[migrations.length - 1]?.version ?? 0;
  const result: MigrationResult = {
    from,
    to: from,
    applied: [],
    backup: null,
    newerThanApp: from > latest,
  };
  if (pending.length === 0) return result;

  if (from > 0) result.backup = backupDatabase(db, backupDir, `v${from}`, now);

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)').run(
        migration.version,
        migration.description,
      );
    })();
    result.applied.push(migration.version);
    result.to = migration.version;
  }
  return result;
}
