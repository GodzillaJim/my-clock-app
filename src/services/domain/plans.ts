import { getTodayDateString, type SessionPlan } from '@/features/timer/types';
import type { FocusDb } from '../db';
import type { HistoryService } from './history';
import type { StatsService } from './stats';
import { createLogger } from '@/services/logger';

const log = createLogger('plans');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local `YYYY-MM-DD`, matching how plans are queried by day. */
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The plan a crash left `active`, closed out as `interrupted` at its last saved
 * moment, so history stays accurate and the plan becomes resumable.
 */
export function finalizeOrphan(plan: SessionPlan, now: number): SessionPlan {
  const interruptedAt = plan.lastUpdated || plan.createdAt || now;
  const segments = plan.segments.map((seg, i) => {
    if (i !== plan.currentSegmentIndex) return seg;
    if (seg.status !== 'in_progress' && seg.status !== 'pending') return seg;
    const elapsed = seg.actualStartTime
      ? Math.max(0, Math.round((interruptedAt - seg.actualStartTime) / 1000))
      : seg.elapsedAtLastUpdate || 0;
    return {
      ...seg,
      status: 'interrupted' as const,
      actualEndTime: interruptedAt,
      actualDuration: seg.actualDuration ?? elapsed,
    };
  });
  return {
    ...plan,
    segments,
    status: 'interrupted',
    interruptedAt,
    actualEndTime: interruptedAt,
    totalElapsed: segments.reduce((total, s) => total + (s.actualDuration || 0), 0),
    lastUpdated: now,
  };
}

/** Session plans: what was planned, what ran, and what a crash interrupted. */
export function createPlanService(db: FocusDb, history: HistoryService, stats: StatsService) {
  return {
    async save(plan: SessionPlan): Promise<void> {
      await db.plans.save(plan);
    },

    async forDate(date: string): Promise<SessionPlan[]> {
      try {
        return await db.plans.getByDate(date);
      } catch (error) {
        log.error('Failed to load plans:', error);
        return [];
      }
    },

    /**
     * Finalizes every plan still `active` from the retention window (orphans of
     * an abrupt shutdown), then refreshes the affected days and lifetime stats.
     * Returns the plans that were orphaned.
     */
    async reconcileOrphans(): Promise<SessionPlan[]> {
      try {
        const now = Date.now();
        const plans = await db.plans.getByDateRange(
          localDate(now - 90 * DAY_MS),
          getTodayDateString(),
        );
        const orphans = plans.filter((p) => p.status === 'active');
        if (orphans.length === 0) return [];

        for (const plan of orphans) await db.plans.save(finalizeOrphan(plan, now));
        for (const date of new Set(orphans.map((p) => localDate(p.createdAt)))) {
          await history.updateDay(date).catch((err) => log.error('Failed to update day:', err));
        }
        await stats.recalculate().catch((err) => log.error('Failed to recalculate stats:', err));
        return orphans;
      } catch (error) {
        log.error('Failed to reconcile orphaned plans:', error);
        return [];
      }
    },
  };
}
