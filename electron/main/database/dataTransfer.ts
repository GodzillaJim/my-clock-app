/**
 * Full-data export, import and backup restore.
 *
 * Import and restore never touch the live database until the incoming data has
 * been loaded into a temporary SQLite file, migrated to the current schema and
 * so checked by every constraint. Only then are the live tables replaced, in a
 * single transaction, after a backup of the current data.
 *
 * No Electron imports: tested against real SQLite.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';
import type { BackupInfo } from '../../ipc/contract';
import {
  LATEST_VERSION,
  MIGRATIONS,
  backupDatabase,
  migrate,
  schemaVersion,
} from './migrationRunner';

/** User data tables. `schema_version` is metadata; `active_snapshot` is transient crash state. */
export const DATA_TABLES = [
  'kv_store',
  'sessions',
  'daily_history',
  'session_plans',
  'plan_segments',
  'challenges',
  'challenge_days',
  'feedback',
] as const;

export const EXPORT_FORMAT = 'focus-sessions-export';
export const EXPORT_FORMAT_VERSION = 1;
/** Refuse files larger than this. */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

type Row = Record<string, string | number | null>;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  tables: Record<(typeof DATA_TABLES)[number], Row[]>;
}

const cell = z.union([z.string(), z.number(), z.null()]);
const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), cell))),
});

const columnsOf = (db: Database.Database, table: string, schema = 'main'): string[] =>
  (db.prepare(`PRAGMA ${schema}.table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name,
  );

/** Every user table, row for row, with the schema version it belongs to. */
export function exportData(
  db: Database.Database,
  appVersion: string,
  now = Date.now(),
): ExportFile {
  const tables = Object.fromEntries(
    DATA_TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as Row[]]),
  ) as ExportFile['tables'];
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: schemaVersion(db),
    exportedAt: new Date(now).toISOString(),
    appVersion,
    tables,
  };
}

/**
 * Replaces every user table of `db` with the contents of the database file at
 * `source` (already at the current schema), in one transaction.
 */
function replaceDataFrom(db: Database.Database, source: string): void {
  db.prepare('ATTACH DATABASE ? AS incoming').run(source);
  try {
    db.transaction(() => {
      for (const table of DATA_TABLES) {
        const columns = columnsOf(db, table).join(', ');
        db.exec(`DELETE FROM main.${table}`);
        db.exec(`INSERT INTO main.${table} (${columns}) SELECT ${columns} FROM incoming.${table}`);
      }
      // A crash snapshot from the old data must not be offered for recovery
      db.exec('DELETE FROM main.active_snapshot');
    })();
  } finally {
    db.exec('DETACH DATABASE incoming');
  }
}

/** A scratch database file in `dir`, removed by the returned cleanup. */
function scratchDatabase(dir: string, now: number) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `incoming-${now}-${process.pid}.db`);
  return {
    file,
    cleanup: () => {
      for (const suffix of ['', '-wal', '-shm', '-journal'])
        fs.rmSync(file + suffix, { force: true });
    },
  };
}

export interface TransferResult {
  /** Rows now in each table. */
  counts: Record<string, number>;
  /** Backup of the data that was replaced. */
  backup: string;
}

const countRows = (db: Database.Database) =>
  Object.fromEntries(
    DATA_TABLES.map((t) => [
      t,
      (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n,
    ]),
  );

/**
 * Validates an export file, loads it into a scratch database at its schema
 * version, migrates that to the current schema, and only then replaces the
 * live data (after backing it up). Throws without changing anything when the
 * file is invalid.
 */
export function importData(
  db: Database.Database,
  json: string,
  dirs: { scratch: string; backups: string },
  now = Date.now(),
): TransferResult {
  if (Buffer.byteLength(json, 'utf8') > MAX_IMPORT_BYTES) throw new Error('The file is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const result = exportSchema.safeParse(parsed);
  if (!result.success) throw new Error('This is not a Focus Sessions export.');
  const file = result.data;
  if (file.schemaVersion > LATEST_VERSION) {
    throw new Error('This export comes from a newer version of Focus Sessions.');
  }

  const scratch = scratchDatabase(dirs.scratch, now);
  try {
    const incoming = new Database(scratch.file);
    try {
      // Build the schema the export was made with, load it, then upgrade
      migrate(
        incoming,
        null,
        now,
        MIGRATIONS.filter((m) => m.version <= file.schemaVersion),
      );
      incoming.transaction(() => {
        for (const table of DATA_TABLES) {
          const rows = file.tables[table] ?? [];
          const known = new Set(columnsOf(incoming, table));
          for (const row of rows) {
            const keys = Object.keys(row);
            const unknown = keys.find((k) => !known.has(k));
            if (unknown) throw new Error(`Unexpected field "${unknown}" in ${table}.`);
            incoming
              .prepare(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((k) => `@${k}`).join(', ')})`,
              )
              .run(row);
          }
        }
      })();
      migrate(incoming, null, now);
    } finally {
      incoming.close();
    }

    const backup = backupDatabase(db, dirs.backups, 'pre-import', now);
    replaceDataFrom(db, scratch.file);
    return { counts: countRows(db), backup };
  } catch (error) {
    if (error instanceof Error && /constraint|datatype|no such|NOT NULL/i.test(error.message)) {
      throw new Error(`The file contains invalid data (${error.message}).`);
    }
    throw error;
  } finally {
    scratch.cleanup();
  }
}

const BACKUP_NAME = /^focus-sessions\.[\w-]+\.[\w-]+\.db$/;

/** Backups in `dir`, newest first. */
export function listBackups(dir: string): BackupInfo[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => BACKUP_NAME.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, createdAt: stat.mtimeMs, sizeBytes: stat.size };
    })
    .sort((a, b) => b.createdAt - a.createdAt || b.name.localeCompare(a.name));
}

/**
 * Restores the backup `name` from `dir` (upgrading it if it is older), after
 * backing up the current data. Only names of existing backups are accepted.
 */
export function restoreBackup(
  db: Database.Database,
  name: string,
  dirs: { scratch: string; backups: string },
  now = Date.now(),
): TransferResult {
  if (!BACKUP_NAME.test(name) || !listBackups(dirs.backups).some((b) => b.name === name)) {
    throw new Error('That backup does not exist.');
  }
  const scratch = scratchDatabase(dirs.scratch, now);
  try {
    fs.copyFileSync(path.join(dirs.backups, name), scratch.file);
    const incoming = new Database(scratch.file);
    try {
      if (schemaVersion(incoming) > LATEST_VERSION) {
        throw new Error('That backup comes from a newer version of Focus Sessions.');
      }
      migrate(incoming, null, now);
    } finally {
      incoming.close();
    }
    const backup = backupDatabase(db, dirs.backups, 'pre-restore', now);
    replaceDataFrom(db, scratch.file);
    return { counts: countRows(db), backup };
  } finally {
    scratch.cleanup();
  }
}
