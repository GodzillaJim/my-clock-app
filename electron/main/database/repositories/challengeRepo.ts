import type Database from 'better-sqlite3';

function fromDbChallenge(row: any, dayRows: any[]): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    durationDays: row.duration_days,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedDays: row.completed_days,
    failedDays: row.failed_days,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    days: dayRows.map((d) => ({
      date: d.date,
      status: d.status,
      note: d.note,
      markedAt: d.marked_at ? new Date(d.marked_at) : undefined,
    })),
  };
}

export function saveWithDays(db: Database.Database, challenge: any): void {
  const saveTx = db.transaction(() => {
    db.prepare(
      `
      INSERT OR REPLACE INTO challenges (id, name, description, start_date, end_date, duration_days,
        status, created_at, updated_at, completed_days, failed_days, current_streak, longest_streak)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      challenge.id,
      challenge.name,
      challenge.description || null,
      challenge.startDate,
      challenge.endDate,
      challenge.durationDays,
      challenge.status,
      new Date(challenge.createdAt).toISOString(),
      new Date(challenge.updatedAt || new Date()).toISOString(),
      challenge.completedDays || 0,
      challenge.failedDays || 0,
      challenge.currentStreak || 0,
      challenge.longestStreak || 0,
    );

    // Delete existing days and re-insert
    db.prepare('DELETE FROM challenge_days WHERE challenge_id = ?').run(challenge.id);

    const insertDay = db.prepare(`
      INSERT INTO challenge_days (challenge_id, date, status, note, marked_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const d of challenge.days || []) {
      insertDay.run(
        challenge.id,
        d.date,
        d.status || 'pending',
        d.note || null,
        d.markedAt ? new Date(d.markedAt).toISOString() : null,
      );
    }
  });
  saveTx();
}

export function getAll(db: Database.Database): any[] {
  const challengeRows = db.prepare('SELECT * FROM challenges ORDER BY created_at DESC').all();
  return challengeRows.map((row: any) => {
    const dayRows = db
      .prepare('SELECT * FROM challenge_days WHERE challenge_id = ? ORDER BY date ASC')
      .all(row.id);
    return fromDbChallenge(row, dayRows);
  });
}

export function getById(db: Database.Database, id: string): any | null {
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id) as any;
  if (!row) return null;
  const dayRows = db
    .prepare('SELECT * FROM challenge_days WHERE challenge_id = ? ORDER BY date ASC')
    .all(id);
  return fromDbChallenge(row, dayRows);
}

export function deleteById(db: Database.Database, id: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM challenge_days WHERE challenge_id = ?').run(id);
    db.prepare('DELETE FROM challenges WHERE id = ?').run(id);
  })();
}

export function markDay(
  db: Database.Database,
  challengeId: string,
  date: string,
  status: string,
  note?: string,
): void {
  db.prepare(
    `
    INSERT OR REPLACE INTO challenge_days (challenge_id, date, status, note, marked_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(challengeId, date, status, note || null, new Date().toISOString());
}
