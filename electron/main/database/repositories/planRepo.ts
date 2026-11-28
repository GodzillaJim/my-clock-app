import type Database from 'better-sqlite3';
import type {
  SegmentStatus,
  SessionPlan,
  SessionPlanStatus,
  SessionType,
} from '../../../../src/features/timer/types';
import type { PlanUpdate } from '../../../ipc/contract';
import { retentionCutoff } from '../retention';

interface PlanRow {
  id: string;
  created_at: number;
  status: string;
  current_segment_index: number;
  settings: string;
  expected_end_time: number;
  actual_end_time: number | null;
  interrupted_at: number | null;
  total_planned_duration: number;
  total_elapsed: number;
  last_updated: number;
}

interface SegmentRow {
  id: string;
  plan_id: string;
  idx: number;
  type: string;
  planned_duration: number;
  actual_duration: number | null;
  expected_start_time: number;
  expected_end_time: number;
  actual_start_time: number | null;
  actual_end_time: number | null;
  status: string;
  paused_time: number;
  elapsed_at_last_update: number;
}

// Columns hold the domain enum values ('focus', 'in_progress', ...) unchanged;
// the schema's CHECK constraints guarantee them.
function fromDbPlan(planRow: PlanRow, segmentRows: SegmentRow[]): SessionPlan {
  return {
    id: planRow.id,
    createdAt: planRow.created_at,
    status: planRow.status as SessionPlanStatus,
    currentSegmentIndex: planRow.current_segment_index,
    settings: JSON.parse(planRow.settings) as SessionPlan['settings'],
    expectedEndTime: planRow.expected_end_time,
    actualEndTime: planRow.actual_end_time,
    interruptedAt: planRow.interrupted_at,
    totalPlannedDuration: planRow.total_planned_duration,
    totalElapsed: planRow.total_elapsed,
    lastUpdated: planRow.last_updated,
    segments: segmentRows.map((seg) => ({
      id: seg.id,
      index: seg.idx,
      type: seg.type as SessionType,
      plannedDuration: seg.planned_duration,
      actualDuration: seg.actual_duration,
      expectedStartTime: seg.expected_start_time,
      expectedEndTime: seg.expected_end_time,
      actualStartTime: seg.actual_start_time,
      actualEndTime: seg.actual_end_time,
      status: seg.status as SegmentStatus,
      pausedTime: seg.paused_time,
      elapsedAtLastUpdate: seg.elapsed_at_last_update,
    })),
  };
}

export function saveWithSegments(db: Database.Database, plan: SessionPlan): void {
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
      plan.actualEndTime ?? null,
      plan.interruptedAt ?? null,
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

    for (const seg of plan.segments) {
      insertSeg.run(
        seg.id,
        plan.id,
        seg.index,
        seg.type,
        seg.plannedDuration,
        seg.actualDuration ?? null,
        seg.expectedStartTime,
        seg.expectedEndTime,
        seg.actualStartTime ?? null,
        seg.actualEndTime ?? null,
        seg.status,
        seg.pausedTime,
        seg.elapsedAtLastUpdate,
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

function segmentsOf(db: Database.Database, planId: string): SegmentRow[] {
  return db
    .prepare('SELECT * FROM plan_segments WHERE plan_id = ? ORDER BY idx ASC')
    .all(planId) as SegmentRow[];
}

export function get(db: Database.Database, id: string): SessionPlan | null {
  const planRow = db.prepare('SELECT * FROM session_plans WHERE id = ?').get(id) as
    PlanRow | undefined;
  return planRow ? fromDbPlan(planRow, segmentsOf(db, id)) : null;
}

export function getByDateRange(
  db: Database.Database,
  startDate: string,
  endDate: string,
): SessionPlan[] {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59.999`).getTime();
  const planRows = db
    .prepare(
      'SELECT * FROM session_plans WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC',
    )
    .all(start, end) as PlanRow[];
  return planRows.map((planRow) => fromDbPlan(planRow, segmentsOf(db, planRow.id)));
}

export function getByDate(db: Database.Database, date: string): SessionPlan[] {
  return getByDateRange(db, date, date);
}

export function update(db: Database.Database, id: string, updates: PlanUpdate): SessionPlan | null {
  const existing = get(db, id);
  if (!existing) return null;

  saveWithSegments(db, { ...existing, ...updates, id, lastUpdated: Date.now() });
  return get(db, id);
}
