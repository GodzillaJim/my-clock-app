import type Database from 'better-sqlite3';
import type {
  FeedbackFilters,
  FeedbackItem,
  FeedbackStats,
  FeedbackUpdate,
} from '../../../../src/types/feedback';

interface FeedbackRow {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  timestamp: string;
  status: string;
}

function fromDbFeedback(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    type: row.type as FeedbackItem['type'],
    title: row.title,
    description: row.description,
    severity: row.severity as FeedbackItem['severity'],
    category: row.category,
    timestamp: new Date(row.timestamp),
    status: row.status as FeedbackItem['status'],
  };
}

export function insert(db: Database.Database, item: FeedbackItem): void {
  db.prepare(
    `
    INSERT OR REPLACE INTO feedback (id, type, title, description, severity, category, timestamp, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    item.id,
    item.type,
    item.title,
    item.description,
    item.severity,
    item.category,
    new Date(item.timestamp).toISOString(),
    item.status,
  );
}

export function getAll(db: Database.Database, filters?: FeedbackFilters): FeedbackItem[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters?.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.severity) {
    conditions.push('severity = ?');
    params.push(filters.severity);
  }

  let query = 'SELECT * FROM feedback';
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY timestamp DESC';
  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = db.prepare(query).all(...params) as FeedbackRow[];
  return rows.map(fromDbFeedback);
}

export function update(db: Database.Database, id: string, updates: FeedbackUpdate): void {
  if (updates.status) {
    db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(updates.status, id);
  }
}

export function deleteById(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM feedback WHERE id = ?').run(id);
}

function countBy(
  db: Database.Database,
  column: 'type' | 'severity' | 'status',
): Map<string, number> {
  const rows = db
    .prepare(`SELECT ${column} AS value, COUNT(*) AS c FROM feedback GROUP BY ${column}`)
    .all() as { value: string; c: number }[];
  return new Map(rows.map((r) => [r.value, r.c]));
}

export function getStats(db: Database.Database): FeedbackStats {
  const byStatus = countBy(db, 'status');
  const byType = countBy(db, 'type');
  const bySeverity = countBy(db, 'severity');
  const total = (db.prepare('SELECT COUNT(*) AS c FROM feedback').get() as { c: number }).c;

  return {
    total,
    open: byStatus.get('open') ?? 0,
    resolved: byStatus.get('resolved') ?? 0,
    inProgress: byStatus.get('in-progress') ?? 0,
    byType: {
      bug: byType.get('bug') ?? 0,
      'feature-request': byType.get('feature-request') ?? 0,
      issue: byType.get('issue') ?? 0,
      general: byType.get('general') ?? 0,
    },
    bySeverity: {
      low: bySeverity.get('low') ?? 0,
      medium: bySeverity.get('medium') ?? 0,
      high: bySeverity.get('high') ?? 0,
      critical: bySeverity.get('critical') ?? 0,
    },
  };
}
