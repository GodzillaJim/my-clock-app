/**
 * The app's domain services, each a thin layer over the store (`FocusDb`)
 * with the calculations in `@/features/stats/stats`. Created here once.
 */
import { db as defaultDb, type FocusDb } from '../db';
import { createChallengeService } from './challenges';
import { createHistoryService } from './history';
import { createPlanService } from './plans';
import { createSessionService } from './sessions';
import { createSettingsService } from './settings';
import { createStatsService } from './stats';

export function createServices(db: FocusDb) {
  const history = createHistoryService(db);
  const stats = createStatsService(db);
  return {
    settings: createSettingsService(db),
    history,
    stats,
    sessions: createSessionService(db, history),
    plans: createPlanService(db, history, stats),
    challenges: createChallengeService(db),
  };
}

export const services = createServices(defaultDb);
