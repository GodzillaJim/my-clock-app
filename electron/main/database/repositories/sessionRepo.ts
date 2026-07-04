import type Database from 'better-sqlite3';

const SESSION_TYPE_TO_DB: Record<string, string> = {
  FOCUS: 'focus', SHORT_BREAK: 'shortBreak', LONG_BREAK: 'longBreak',
  focus: 'focus', shortBreak: 'shortBreak', longBreak: 'longBreak',
};
const DB_TO_SESSION_TYPE: Record<string, string> = {
  focus: 'FOCUS', shortBreak: 'SHORT_BREAK', longBreak: 'LONG_BREAK',
};
const STATUS_TO_DB: Record<string, string> = {
  COMPLETED: 'completed', INTERRUPTED: 'interrupted', SKIPPED: 'skipped',
  completed: 'completed', interrupted: 'interrupted', skipped: 'skipped',
};
const DB_TO_STATUS: Record<string, string> = {
  completed: 'COMPLETED', interrupted: 'INTERRUPTED', skipped: 'SKIPPED',
};

function toDbSession(s: any) {
  const startDate = new Date(s.startTime).toISOString().split('T')[0];
  return {
    id: s.id,
    type: SESSION_TYPE_TO_DB[s.type] || 'focus',
    session_number: s.sessionNumber || 0,
    planned_duration: s.plannedDuration || 0,
    actual_duration: s.actualDuration || 0,
    start_time: new Date(s.startTime).toISOString(),
    end_time: s.endTime ? new Date(s.endTime).toISOString() : null,
    paused_time: s.pausedTime || 0,
    completion_status: STATUS_TO_DB[s.completionStatus] || 'completed',
    remaining_time: s.remainingTime || 0,
    plan_id: s.planId || null,
    created_date: startDate,
  };
}

function fromDbSession(row: any) {
  return {
    id: row.id,
    type: DB_TO_SESSION_TYPE[row.type] || row.type,
    sessionNumber: row.session_number,
    plannedDuration: row.planned_duration,
    actualDuration: row.actual_duration,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : null,
    pausedTime: row.paused_time,
    completionStatus: DB_TO_STATUS[row.completion_status] || row.completion_status,
    remainingTime: row.remaining_time,
  };
}

export function insert(db: Database.Database, session: any): void {
  const d = toDbSession(session);
  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, type, session_number, planned_duration, actual_duration,
      start_time, end_time, paused_time, completion_status, remaining_time, plan_id, created_date)
    VALUES (@id, @type, @session_number, @planned_duration, @actual_duration,
      @start_time, @end_time, @paused_time, @completion_status, @remaining_time, @plan_id, @created_date)
  `).run(d);

  // Enforce 1000 session limit
  db.prepare(`
    DELETE FROM sessions WHERE id NOT IN (
      SELECT id FROM sessions ORDER BY start_time DESC LIMIT 1000
    )
  `).run();
}

export function getByDate(db: Database.Database, date: string): any[] {
  const rows = db.prepare(
    'SELECT * FROM sessions WHERE created_date = ? ORDER BY start_time ASC'
  ).all(date);
  return rows.map(fromDbSession);
}

export function getHistory(db: Database.Database, limit: number = 50): any[] {
  const rows = db.prepare(
    'SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?'
  ).all(limit);
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
