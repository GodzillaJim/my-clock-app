import type Database from 'better-sqlite3';
import { handle } from '../ipc';
import * as sessionRepo from './repositories/sessionRepo';
import * as planRepo from './repositories/planRepo';
import * as dailyHistoryRepo from './repositories/dailyHistoryRepo';
import * as challengeRepo from './repositories/challengeRepo';
import * as feedbackRepo from './repositories/feedbackRepo';
import * as kvRepo from './repositories/kvRepo';
import * as snapshotRepo from './repositories/snapshotRepo';

/** Database channels of the IPC contract; arguments are schema-validated by `handle`. */
export function registerDatabaseHandlers(db: Database.Database): void {
  // Sessions
  handle('db:sessions:save', (session) => sessionRepo.insert(db, session));
  handle('db:sessions:getByDate', (date) => sessionRepo.getByDate(db, date));
  handle('db:sessions:getHistory', (limit) => sessionRepo.getHistory(db, limit));
  handle('db:sessions:delete', (id) => sessionRepo.deleteById(db, id));

  // Session plans
  handle('db:plans:save', (plan) => planRepo.saveWithSegments(db, plan));
  handle('db:plans:get', (id) => planRepo.get(db, id));
  handle('db:plans:getByDate', (date) => planRepo.getByDate(db, date));
  handle('db:plans:getByDateRange', (start, end) => planRepo.getByDateRange(db, start, end));
  handle('db:plans:update', (id, updates) => planRepo.update(db, id, updates));

  // Daily history
  handle('db:history:save', (history) => dailyHistoryRepo.save(db, history));
  handle('db:history:getByDate', (date) => dailyHistoryRepo.getByDate(db, date));
  handle('db:history:getByRange', (start, end) => dailyHistoryRepo.getByRange(db, start, end));
  handle('db:history:getAllDates', () => dailyHistoryRepo.getAllDates(db));
  handle('db:history:clearToday', (date) =>
    db.transaction(() => {
      dailyHistoryRepo.deleteByDate(db, date);
      sessionRepo.deleteByDate(db, date);
    })(),
  );
  handle('db:history:resetAll', () =>
    db.transaction(() => {
      sessionRepo.deleteAll(db);
      dailyHistoryRepo.deleteAll(db);
    })(),
  );

  // Challenges
  handle('db:challenges:getAll', () => challengeRepo.getAll(db));
  handle('db:challenges:getById', (id) => challengeRepo.getById(db, id));
  handle('db:challenges:save', (challenge) => challengeRepo.saveWithDays(db, challenge));
  handle('db:challenges:delete', (id) => challengeRepo.deleteById(db, id));

  // Feedback
  handle('db:feedback:getAll', (filters) => feedbackRepo.getAll(db, filters));
  handle('db:feedback:save', (item) => feedbackRepo.insert(db, item));
  handle('db:feedback:update', (id, updates) => feedbackRepo.update(db, id, updates));
  handle('db:feedback:delete', (id) => feedbackRepo.deleteById(db, id));
  handle('db:feedback:getStats', () => feedbackRepo.getStats(db));

  // Key-value documents (app state, lifetime stats)
  handle('db:kv:get', (key) => kvRepo.get(db, key));
  handle('db:kv:set', (...entry) => kvRepo.set(db, ...entry));

  // Active plan snapshot (crash recovery)
  handle('db:snapshot:save', (plan) => snapshotRepo.save(db, plan));
  handle('db:snapshot:load', () => snapshotRepo.load(db));
  handle('db:snapshot:clear', () => snapshotRepo.clear(db));
}
