import type { PlanSnapshot } from '../../electron/ipc/contract';
import type { SessionPlan } from '@/features/timer/types';
import { db as defaultDb, type FocusDb } from './db';
import { createLogger } from '@/services/logger';

const log = createLogger('persistenceService');

/**
 * The crash-recovery snapshot of the running plan. better-sqlite3 writes
 * synchronously in the main process, so a snapshot is on disk once its IPC
 * call returns. Saves are fire-and-forget: the timer must never wait on them.
 */
export function createPersistenceService(db: FocusDb) {
  return {
    savePlanSnapshot(plan: SessionPlan): void {
      db.snapshot.save(plan).catch((err) => log.error('Failed to save plan snapshot:', err));
    },

    async loadPlanSnapshot(): Promise<PlanSnapshot | null> {
      try {
        return await db.snapshot.load();
      } catch (error) {
        log.error('Failed to load plan snapshot:', error);
        return null;
      }
    },

    clearPlanSnapshot(): void {
      db.snapshot.clear().catch((err) => log.error('Failed to clear plan snapshot:', err));
    },
  };
}

export const persistenceService = createPersistenceService(defaultDb);
