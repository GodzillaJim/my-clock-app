import type Database from 'better-sqlite3';
import type { KvEntry, KvKey, KvValues } from '../../../ipc/contract';

export function get<K extends KvKey>(db: Database.Database, key: K): KvValues[K] | null {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as
    { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as KvValues[K];
  } catch {
    return null;
  }
}

export function set(db: Database.Database, ...[key, value]: KvEntry): void {
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
    key,
    JSON.stringify(value),
    Date.now(),
  );
}
