import type Database from 'better-sqlite3';
import { retentionCutoff } from '../retention';

const TYPE_TO_DB: Record<string, string> = {
  FOCUS: 'focus',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak',
  focus: 'focus',
  shortBreak: 'shortBreak',
  longBreak: 'longBreak',
};
const DB_TO_TYPE: Record<string, string> = {
  focus: 'FOCUS',
  shortBreak: 'SHORT_BREAK',
  longBreak: 'LONG_BREAK',
};

function fromDbPlan(planRow: any, segmentRows: any[]): any {
  return {
    id: planRow.id,
    createdAt: planRow.created_at,
    status: planRow.status,
    currentSegmentIndex: planRow.current_segment_index,
    settings: JSON.parse(planRow.settings),
    expectedEndTime: planRow.expected_end_time,
    actualEndTime: planRow.actual_end_time,
    interruptedAt: planRow.interrupted_at,
    totalPlannedDuration: planRow.total_planned_duration,
    totalElapsed: planRow.total_elapsed,
    lastUpdated: planRow.last_updated,
    segments: segmentRows.map((seg) => ({
      id: seg.id,
      index: seg.idx,
      type: DB_TO_TYPE[seg.type] || seg.type,
      plannedDuration: seg.planned_duration,
      actualDuration: seg.actual_duration,
      expectedStartTime: seg.expected_start_time,
      expectedEndTime: seg.expected_end_time,
      actualStartTime: seg.actual_start_time,
      actualEndTime: seg.actual_end_time,
      status: seg.status,
      pausedTime: seg.paused_time,
      elapsedAtLastUpdate: seg.elapsed_at_last_update,
    })),
  };
}

export function saveWithSegments(db: Database.Database, plan: any): void {
  const saveTx = db.transaction(() => {
    db.prepare(
      `
      INSERT OR REPLACE INTO session_plans (id, created_at, status, current_segment_index, settings,
        expected_end_time, actual_end_time, interrupted_at, total_planned_duration, total_elapsed, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      plan.id,
      plan.createdAt,
      plan.status,
      plan.currentSegmentIndex,
      JSON.stringify(plan.settings),
      plan.expectedEndTime,
      plan.actualEndTime || null,
      plan.interruptedAt || null,
      plan.totalPlannedDuration,
      plan.totalElapsed,
      plan.lastUpdated,
    );

    // Delete existing segments and re-insert
    db.prepare('DELETE FROM plan_segments WHERE plan_id = ?').run(plan.id);

    const insertSeg = db.prepare(`
      INSERT INTO plan_segments (id, plan_id, idx, type, planned_duration, actual_duration,
        expected_start_time, expected_end_time, actual_start_time, actual_end_time, status, paused_time, elapsed_at_last_update)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const seg of plan.segments || []) {
      insertSeg.run(
        seg.id,
        plan.id,
        seg.index,
        TYPE_TO_DB[seg.type] || seg.type || 'focus',
        seg.plannedDuration,
        seg.actualDuration || null,
        seg.expectedStartTime,
        seg.expectedEndTime,
        seg.actualStartTime || null,
        seg.actualEndTime || null,
        seg.status || 'pending',
        seg.pausedTime || 0,
        seg.elapsedAtLastUpdate || 0,
      );
    }

    // Enforce date-based retention
    const { timestamp: cutoff } = retentionCutoff();
    db.prepare(
      'DELETE FROM plan_segments WHERE plan_id IN (SELECT id FROM session_plans WHERE created_at < ?)',
    ).run(cutoff);
    db.prepare('DELETE FROM session_plans WHERE created_at < ?').run(cutoff);
  });
  saveTx();
}

export function get(db: Database.Database, id: string): any | null {
  const planRow = db.prepare('SELECT * FROM session_plans WHERE id = ?').get(id);
  if (!planRow) return null;
  const segmentRows = db
    .prepare('SELECT * FROM plan_segments WHERE plan_id = ? ORDER BY idx ASC')
    .all(id);
  return fromDbPlan(planRow, segmentRows);
}

export function getByDateRange(db: Database.Database, startDate: string, endDate: string): any[] {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59.999`).getTime();
  const planRows = db
    .prepare(
      'SELECT * FROM session_plans WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC',
    )
    .all(start, end);

  return planRows.map((planRow: any) => {
    const segmentRows = db
      .prepare('SELECT * FROM plan_segments WHERE plan_id = ? ORDER BY idx ASC')
      .all(planRow.id);
    return fromDbPlan(planRow, segmentRows);
  });
}

export function getByDate(db: Database.Database, date: string): any[] {
  return getByDateRange(db, date, date);
}

export function update(db: Database.Database, id: string, updates: any): any | null {
  const existing = get(db, id);
  if (!existing) return null;

  const merged = { ...existing, ...updates, lastUpdated: Date.now() };
  saveWithSegments(db, merged);
  return get(db, id);
}

export function updateSegment(
  db: Database.Database,
  segmentId: string,
  updates: Record<string, any>,
): void {
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    // Map camelCase to snake_case
    const colMap: Record<string, string> = {
      actualDuration: 'actual_duration',
      actualStartTime: 'actual_start_time',
      actualEndTime: 'actual_end_time',
      elapsedAtLastUpdate: 'elapsed_at_last_update',
      pausedTime: 'paused_time',
      status: 'status',
    };
    const col = colMap[key] || key;
    setClauses.push(`${col} = ?`);
    values.push(value);
  }

  if (setClauses.length > 0) {
    values.push(segmentId);
    db.prepare(`UPDATE plan_segments SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }
}
