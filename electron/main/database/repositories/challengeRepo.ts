import type Database from 'better-sqlite3';
import type {
  Challenge,
  ChallengeDayStatus,
  ChallengeStatus,
} from '../../../../src/features/timer/types';

interface ChallengeRow {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  status: string;
  created_at: string;
  updated_at: string;
  completed_days: number;
  failed_days: number;
  current_streak: number;
  longest_streak: number;
}

interface DayRow {
  challenge_id: string;
  date: string;
  status: string;
  note: string | null;
  marked_at: string | null;
}

function fromDbChallenge(row: ChallengeRow, dayRows: DayRow[]): Challenge {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    durationDays: row.duration_days,
    status: row.status as ChallengeStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedDays: row.completed_days,
    failedDays: row.failed_days,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    days: dayRows.map((d) => ({
      date: d.date,
      status: d.status as ChallengeDayStatus,
      note: d.note ?? undefined,
      markedAt: d.marked_at ? new Date(d.marked_at) : undefined,
    })),
  };
}

export function saveWithDays(db: Database.Database, challenge: Challenge): void {
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
      challenge.description ?? null,
      challenge.startDate,
      challenge.endDate,
      challenge.durationDays,
      challenge.status,
      new Date(challenge.createdAt).toISOString(),
      new Date(challenge.updatedAt).toISOString(),
      challenge.completedDays,
      challenge.failedDays,
      challenge.currentStreak,
      challenge.longestStreak,
    );

    // Delete existing days and re-insert
    db.prepare('DELETE FROM challenge_days WHERE challenge_id = ?').run(challenge.id);

    const insertDay = db.prepare(`
      INSERT INTO challenge_days (challenge_id, date, status, note, marked_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const d of challenge.days) {
      insertDay.run(
        challenge.id,
        d.date,
        d.status,
        d.note ?? null,
        d.markedAt ? new Date(d.markedAt).toISOString() : null,
      );
    }
  });
  saveTx();
}

function daysOf(db: Database.Database, challengeId: string): DayRow[] {
  return db
    .prepare('SELECT * FROM challenge_days WHERE challenge_id = ? ORDER BY date ASC')
    .all(challengeId) as DayRow[];
}

export function getAll(db: Database.Database): Challenge[] {
  const rows = db
    .prepare('SELECT * FROM challenges ORDER BY created_at DESC')
    .all() as ChallengeRow[];
  return rows.map((row) => fromDbChallenge(row, daysOf(db, row.id)));
}

export function getById(db: Database.Database, id: string): Challenge | null {
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id) as
    ChallengeRow | undefined;
  return row ? fromDbChallenge(row, daysOf(db, id)) : null;
}

export function deleteById(db: Database.Database, id: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM challenge_days WHERE challenge_id = ?').run(id);
    db.prepare('DELETE FROM challenges WHERE id = ?').run(id);
  })();
}
