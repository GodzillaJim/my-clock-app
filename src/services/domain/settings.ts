import { DEFAULT_SETTINGS, getTodayDateString, type AppState } from '@/features/timer/types';
import type { FocusDb } from '../db';
import { createLogger } from '@/services/logger';

const log = createLogger('settings');

/** App state and settings, stored as one key-value document. */
export function createSettingsService(db: FocusDb) {
  return {
    /** The saved state with today's defaults filled in; defaults if nothing is saved. */
    async load(): Promise<AppState> {
      const defaults: AppState = {
        version: '1.0.0',
        currentSession: null,
        dailyHistory: null,
        settings: DEFAULT_SETTINGS,
        lastActiveDate: getTodayDateString(),
      };
      try {
        const saved = await db.kv.get('app_state');
        if (!saved) return defaults;
        const state: AppState = {
          ...defaults,
          ...saved,
          // Settings added in newer versions get their defaults
          settings: { ...DEFAULT_SETTINGS, ...saved.settings },
        };
        if (state.lastActiveDate !== getTodayDateString()) {
          state.currentSession = null;
          state.lastActiveDate = getTodayDateString();
        }
        return state;
      } catch (error) {
        log.error('Failed to load app state:', error);
        return defaults;
      }
    },

    async save(state: AppState): Promise<void> {
      await db.kv.set('app_state', state);
    },
  };
}
