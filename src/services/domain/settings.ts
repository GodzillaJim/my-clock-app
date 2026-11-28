import {
  DEFAULT_SETTINGS,
  getTodayDateString,
  type AppSettings,
  type AppState,
} from '@/features/timer/types';
import type { FocusDb } from '../db';
import { createLogger } from '@/services/logger';

const log = createLogger('settings');

/**
 * Saved settings brought up to the current shape: settings added in newer versions get
 * their defaults, and the retired visual styles (`uiTheme`) map onto the one style.
 * Deep Focus was always dark, so it becomes the dark theme; Aerogel keeps its setting.
 */
export function migrateSettings(saved: unknown): AppSettings {
  const { uiTheme, ...rest } = (saved ?? {}) as Partial<AppSettings> & { uiTheme?: unknown };
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...rest };
  if (uiTheme === 'deepFocus') settings.theme = 'dark';
  return settings;
}

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
          settings: migrateSettings(saved.settings),
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
