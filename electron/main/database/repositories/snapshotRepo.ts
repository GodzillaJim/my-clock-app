import type Database from 'better-sqlite3';

export function save(db: Database.Database, plan: any): void {
  db.prepare(
    'INSERT OR REPLACE INTO active_snapshot (id, plan, last_updated) VALUES (1, ?, ?)'
  ).run(JSON.stringify(plan), Date.now());
}

export function load(db: Database.Database): { plan: any; lastUpdated: number } | null {
  const row = db.prepare('SELECT plan, last_updated FROM active_snapshot WHERE id = 1').get() as
    { plan: string; last_updated: number } | undefined;
  if (!row) return null;
  try {
    return {
      plan: JSON.parse(row.plan),
      lastUpdated: row.last_updated,
    };
  } catch {
    return null;
  }
}

export function clear(db: Database.Database): void {
  db.prepare('DELETE FROM active_snapshot WHERE id = 1').run();
}
