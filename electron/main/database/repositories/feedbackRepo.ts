import type Database from 'better-sqlite3';

function fromDbFeedback(row: any): any {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    severity: row.severity,
    category: row.category,
    timestamp: new Date(row.timestamp),
    status: row.status,
  };
}

export function insert(db: Database.Database, item: any): void {
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
    item.status || 'open',
  );
}

export function getAll(db: Database.Database, filters?: any): any[] {
  let query = 'SELECT * FROM feedback';
  const conditions: string[] = [];
  const params: any[] = [];

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

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY timestamp DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db
    .prepare(query)
    .all(...params)
    .map(fromDbFeedback);
}

export function update(db: Database.Database, id: string, updates: any): void {
  if (updates.status) {
    db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(updates.status, id);
  }
}

export function deleteById(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM feedback WHERE id = ?').run(id);
}

export function getStats(db: Database.Database): any {
  const total = (db.prepare('SELECT COUNT(*) as c FROM feedback').get() as any).c;
  const open = (db.prepare("SELECT COUNT(*) as c FROM feedback WHERE status = 'open'").get() as any)
    .c;
  const resolved = (
    db.prepare("SELECT COUNT(*) as c FROM feedback WHERE status = 'resolved'").get() as any
  ).c;
  const inProgress = (
    db.prepare("SELECT COUNT(*) as c FROM feedback WHERE status = 'in-progress'").get() as any
  ).c;

  return {
    total,
    open,
    resolved,
    inProgress,
    byType: {
      bug: (db.prepare("SELECT COUNT(*) as c FROM feedback WHERE type = 'bug'").get() as any).c,
      'feature-request': (
        db.prepare("SELECT COUNT(*) as c FROM feedback WHERE type = 'feature-request'").get() as any
      ).c,
      issue: (db.prepare("SELECT COUNT(*) as c FROM feedback WHERE type = 'issue'").get() as any).c,
      general: (
        db.prepare("SELECT COUNT(*) as c FROM feedback WHERE type = 'general'").get() as any
      ).c,
    },
    bySeverity: {
      low: (db.prepare("SELECT COUNT(*) as c FROM feedback WHERE severity = 'low'").get() as any).c,
      medium: (
        db.prepare("SELECT COUNT(*) as c FROM feedback WHERE severity = 'medium'").get() as any
      ).c,
      high: (db.prepare("SELECT COUNT(*) as c FROM feedback WHERE severity = 'high'").get() as any)
        .c,
      critical: (
        db.prepare("SELECT COUNT(*) as c FROM feedback WHERE severity = 'critical'").get() as any
      ).c,
    },
  };
}
