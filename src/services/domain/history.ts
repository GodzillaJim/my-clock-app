import { getTodayDateString, type DailyHistory } from '@/features/timer/types';
import { emptyDay, summarizeDay } from '@/features/stats/stats';
import type { FocusDb } from '../db';
import { createLogger } from '@/services/logger';

const log = createLogger('history');

/** Per-day summaries, kept in step with the sessions and plans of each day. */
export function createHistoryService(db: FocusDb) {
  /** A day's summary with its sessions loaded (they live in their own table). */
  async function byDate(date: string): Promise<DailyHistory | null> {
    try {
      const day = await db.history.getByDate(date);
      if (day) day.sessions = await db.sessions.getByDate(date);
      return day;
    } catch (error) {
      log.error('Failed to load day:', error);
      return null;
    }
  }

  return {
    byDate,

    async today(): Promise<DailyHistory> {
      const date = getTodayDateString();
      return (await byDate(date)) ?? emptyDay(date, Date.now());
    },

    /** Summaries in a date range, without their sessions. */
    async forPeriod(start: string, end: string): Promise<DailyHistory[]> {
      try {
        return await db.history.getByRange(start, end);
      } catch (error) {
        log.error('Failed to load history for period:', error);
        return [];
      }
    },

    /** Recomputes and stores the summary of `date` from its sessions and plans. */
    async updateDay(date: string): Promise<void> {
      const [sessions, plans, existing] = await Promise.all([
        db.sessions.getByDate(date),
        db.plans.getByDate(date),
        db.history.getByDate(date),
      ]);
      const now = Date.now();
      await db.history.save(summarizeDay(date, sessions, plans, now, existing?.createdAt));
    },
  };
}

export type HistoryService = ReturnType<typeof createHistoryService>;
