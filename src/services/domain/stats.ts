import type { LifetimeStats } from '@/features/timer/types';
import { emptyLifetimeStats, summarizeLifetime } from '@/features/stats/stats';
import type { FocusDb } from '../db';
import { createLogger } from '@/services/logger';

const log = createLogger('stats');

/** Lifetime statistics, cached as a key-value document and recomputed on demand. */
export function createStatsService(db: FocusDb) {
  return {
    async get(): Promise<LifetimeStats> {
      try {
        return (await db.kv.get('lifetime_stats')) ?? emptyLifetimeStats();
      } catch (error) {
        log.error('Failed to load lifetime stats:', error);
        return emptyLifetimeStats();
      }
    },

    /** Recomputes from every stored day, saves and returns the result. */
    async recalculate(): Promise<LifetimeStats> {
      const dates = await db.history.getAllDates();
      let stats = emptyLifetimeStats();
      if (dates.length > 0) {
        const days = await db.history.getByRange(dates[dates.length - 1], dates[0]);
        for (const day of days) day.sessions = await db.sessions.getByDate(day.date);
        stats = summarizeLifetime(days, Date.now());
      }
      await db.kv.set('lifetime_stats', stats);
      return stats;
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
