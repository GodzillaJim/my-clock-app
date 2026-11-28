import type Database from 'better-sqlite3';
import type {
  CompletionStatus,
  SessionRecord,
  SessionType,
} from '../../../../src/features/timer/types';
import { retentionCutoff } from '../retention';

interface SessionRow {
  id: string;
  type: string;
  session_number: number;
  planned_duration: number;
  actual_duration: number;
  start_time: string;
  end_time: string | null;
  paused_time: number;
  completion_status: string;
  remaining_time: number;
  plan_id: string | null;
  created_date: string;
}

// Columns hold the domain enum values ('focus', 'completed', ...) unchanged;
// the schema's CHECK constraints guarantee them.
function toDbSession(s: SessionRecord): SessionRow {
  const start = new Date(s.startTime);
  return {
    id: s.id,
    type: s.type,
    session_number: s.sessionNumber,
    planned_duration: s.plannedDuration,
    actual_duration: s.actualDuration,
    start_time: start.toISOString(),
    end_time: s.endTime ? new Date(s.endTime).toISOString() : null,
    paused_time: s.pausedTime,
    completion_status: s.completionStatus,
    remaining_time: s.remainingTime,
    plan_id: null,
    created_date: start.toISOString().split('T')[0],
  };
}

function fromDbSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    type: row.type as SessionType,
    sessionNumber: row.session_number,
    plannedDuration: row.planned_duration,
    actualDuration: row.actual_duration,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : null,
    pausedTime: row.paused_time,
    completionStatus: row.completion_status as CompletionStatus,
    remainingTime: row.remaining_time,
  };
}

export function insert(db: Database.Database, session: SessionRecord): void {
  db.prepare(
    `
    INSERT OR REPLACE INTO sessions (id, type, session_number, planned_duration, actual_duration,
      start_time, end_time, paused_time, completion_status, remaining_time, plan_id, created_date)
    VALUES (@id, @type, @session_number, @planned_duration, @actual_duration,
      @start_time, @end_time, @paused_time, @completion_status, @remaining_time, @plan_id, @created_date)
  `,
  ).run(toDbSession(session));

  // Enforce date-based retention (no cap on how many sessions a day may hold)
  db.prepare('DELETE FROM sessions WHERE created_date < ?').run(retentionCutoff().date);
}

export function getByDate(db: Database.Database, date: string): SessionRecord[] {
  const rows = db
    .prepare('SELECT * FROM sessions WHERE created_date = ? ORDER BY start_time ASC')
    .all(date) as SessionRow[];
  return rows.map(fromDbSession);
}

/** Most recent sessions first; all retained sessions when `limit` is omitted. */
export function getHistory(db: Database.Database, limit?: number): SessionRecord[] {
  const rows = (
    limit === undefined
      ? db.prepare('SELECT * FROM sessions ORDER BY start_time DESC').all()
      : db.prepare('SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?').all(limit)
  ) as SessionRow[];
  return rows.map(fromDbSession);
}

export function deleteById(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function deleteByDate(db: Database.Database, date: string): void {
  db.prepare('DELETE FROM sessions WHERE created_date = ?').run(date);
}

export function deleteAll(db: Database.Database): void {
  db.prepare('DELETE FROM sessions').run();
}
