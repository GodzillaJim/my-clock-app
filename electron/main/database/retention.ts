/** How long session records, plans and daily history are kept. */
export const RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The oldest point in time still retained, as an epoch timestamp (for
 * `created_at`-style columns) and a `YYYY-MM-DD` UTC date (for
 * `created_date`/`date` columns, which are written with `toISOString()`).
 */
export function retentionCutoff(now: Date = new Date()): { timestamp: number; date: string } {
  const timestamp = now.getTime() - RETENTION_DAYS * DAY_MS;
  return { timestamp, date: new Date(timestamp).toISOString().split('T')[0] };
}
