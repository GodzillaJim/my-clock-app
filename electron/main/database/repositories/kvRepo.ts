import type Database from 'better-sqlite3';

export function get(db: Database.Database, key: string): any | null {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function set(db: Database.Database, key: string, value: any): void {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(
    'INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)'
  ).run(key, json, Date.now());
}

export function remove(db: Database.Database, key: string): void {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
}
