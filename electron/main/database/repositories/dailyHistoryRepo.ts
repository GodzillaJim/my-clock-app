import type Database from 'better-sqlite3';
import { retentionCutoff } from '../retention';

function fromDbHistory(row: any): any {
  return {
    date: row.date,
    sessions: [], // Sessions are in the sessions table, not embedded
    totalFocusTime: row.total_focus_time,
    totalBreakTime: row.total_break_time,
    completedSessions: row.completed_sessions,
    interruptedSessions: row.interrupted_sessions,
    skippedSessions: row.skipped_sessions,
    averageSessionLength: row.average_session_length,
    longestStreak: row.longest_streak,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    dayStartTime: row.day_start_time,
    dayEndTime: row.day_end_time,
    sessionPlanIds: JSON.parse(row.session_plan_ids || '[]'),
    totalPlannedTime: row.total_planned_time,
    totalActualTime: row.total_actual_time,
    completionRate: row.completion_rate,
  };
}

export function save(db: Database.Database, history: any): void {
  db.prepare(
    `
    INSERT OR REPLACE INTO daily_history (date, total_focus_time, total_break_time, completed_sessions,
      interrupted_sessions, skipped_sessions, average_session_length, longest_streak,
      created_at, updated_at, day_start_time, day_end_time, session_plan_ids,
      total_planned_time, total_actual_time, completion_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    history.date,
    history.totalFocusTime || 0,
    history.totalBreakTime || 0,
    history.completedSessions || 0,
    history.interruptedSessions || 0,
    history.skippedSessions || 0,
    history.averageSessionLength || 0,
    history.longestStreak || 0,
    new Date(history.createdAt).toISOString(),
    new Date(history.updatedAt || new Date()).toISOString(),
    history.dayStartTime || null,
    history.dayEndTime || null,
    JSON.stringify(history.sessionPlanIds || []),
    history.totalPlannedTime || 0,
    history.totalActualTime || 0,
    history.completionRate || 0,
  );

  // Enforce date-based retention
  db.prepare('DELETE FROM daily_history WHERE date < ?').run(retentionCutoff().date);
}

export function getByDate(db: Database.Database, date: string): any | null {
  const row = db.prepare('SELECT * FROM daily_history WHERE date = ?').get(date);
  return row ? fromDbHistory(row) : null;
}

export function getByRange(db: Database.Database, startDate: string, endDate: string): any[] {
  const rows = db
    .prepare('SELECT * FROM daily_history WHERE date >= ? AND date <= ? ORDER BY date ASC')
    .all(startDate, endDate);
  return rows.map(fromDbHistory);
}

export function getAllDates(db: Database.Database): string[] {
  const rows = db.prepare('SELECT date FROM daily_history ORDER BY date DESC').all() as {
    date: string;
  }[];
  return rows.map((r) => r.date);
}

export function deleteByDate(db: Database.Database, date: string): void {
  db.prepare('DELETE FROM daily_history WHERE date = ?').run(date);
}

export function deleteAll(db: Database.Database): void {
  db.prepare('DELETE FROM daily_history').run();
}
