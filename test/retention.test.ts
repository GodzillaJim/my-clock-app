import { describe, expect, it } from 'vitest';
import { RETENTION_DAYS, retentionCutoff } from '../electron/main/database/retention';

describe('retentionCutoff', () => {
  it('is exactly RETENTION_DAYS before now', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const { timestamp, date } = retentionCutoff(now);

    expect(RETENTION_DAYS).toBe(90);
    expect(now.getTime() - timestamp).toBe(90 * 24 * 60 * 60 * 1000);
    expect(date).toBe('2026-03-17');
  });

  it('formats the date in UTC, matching how created_date is written', () => {
    // 00:30 UTC on Jan 1 → cutoff 90 days earlier is Oct 3 (UTC), regardless of local timezone
    const { date } = retentionCutoff(new Date('2027-01-01T00:30:00Z'));
    expect(date).toBe('2026-10-03');
  });
});
