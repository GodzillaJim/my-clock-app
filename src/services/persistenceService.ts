import { ActiveSessionSnapshot, ActivePlanSnapshot, SNAPSHOT_KEY, PLAN_SNAPSHOT_KEY } from '@/types/Persistence';
import { SessionPlan } from '@/features/timer/types';

const hasDb = () => !!window.electronAPI?.db;

export const persistenceService = {
  // Generic snapshots (used by ZenCountdownTimer and ZenStopwatch)
  saveSnapshot: (snapshot: ActiveSessionSnapshot, key: string = SNAPSHOT_KEY): void => {
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Failed to save session snapshot:', error);
    }
  },

  loadSnapshot: (key: string = SNAPSHOT_KEY): ActiveSessionSnapshot | null => {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as ActiveSessionSnapshot;
    } catch (error) {
      console.error('Failed to load session snapshot:', error);
      return null;
    }
  },

  clearSnapshot: (key: string = SNAPSHOT_KEY): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear session snapshot:', error);
    }
  },

  // Plan snapshot — SQLite-backed when in Electron for crash durability
  savePlanSnapshot: (plan: SessionPlan): void => {
    if (hasDb()) {
      // Fire-and-forget IPC — better-sqlite3 is synchronous on the main process,
      // so data is fsync'd to disk before the IPC response returns
      window.electronAPI!.db.snapshot.save(plan).catch(err =>
        console.error('Failed to save plan snapshot to SQLite:', err)
      );
      return;
    }
    try {
      const snapshot: ActivePlanSnapshot = { plan, lastUpdated: Date.now() };
      localStorage.setItem(PLAN_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Failed to save plan snapshot:', error);
    }
  },

  loadPlanSnapshot: async (): Promise<ActivePlanSnapshot | null> => {
    if (hasDb()) {
      try {
        const result = await window.electronAPI!.db.snapshot.load();
        if (!result) return null;
        return { plan: result.plan, lastUpdated: result.lastUpdated };
      } catch (error) {
        console.error('Failed to load plan snapshot from SQLite:', error);
        return null;
      }
    }
    try {
      const data = localStorage.getItem(PLAN_SNAPSHOT_KEY);
      if (!data) return null;
      return JSON.parse(data) as ActivePlanSnapshot;
    } catch (error) {
      console.error('Failed to load plan snapshot:', error);
      return null;
    }
  },

  clearPlanSnapshot: (): void => {
    if (hasDb()) {
      window.electronAPI!.db.snapshot.clear().catch(err =>
        console.error('Failed to clear plan snapshot from SQLite:', err)
      );
      // Also clear localStorage in case there's a stale entry from pre-migration
      try { localStorage.removeItem(PLAN_SNAPSHOT_KEY); } catch { /* ignore */ }
      return;
    }
    try {
      localStorage.removeItem(PLAN_SNAPSHOT_KEY);
    } catch (error) {
      console.error('Failed to clear plan snapshot:', error);
    }
  }
};
