import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import * as sessionRepo from './repositories/sessionRepo';
import * as planRepo from './repositories/planRepo';
import * as dailyHistoryRepo from './repositories/dailyHistoryRepo';
import * as challengeRepo from './repositories/challengeRepo';
import * as feedbackRepo from './repositories/feedbackRepo';
import * as kvRepo from './repositories/kvRepo';
import * as snapshotRepo from './repositories/snapshotRepo';

export function registerDatabaseHandlers(db: Database.Database): void {
  // Sessions
  ipcMain.handle('db:sessions:save', (_, session) => {
    sessionRepo.insert(db, session);
  });

  ipcMain.handle('db:sessions:getByDate', (_, date: string) => {
    return sessionRepo.getByDate(db, date);
  });

  ipcMain.handle('db:sessions:getHistory', (_, limit?: number) => {
    return sessionRepo.getHistory(db, limit);
  });

  ipcMain.handle('db:sessions:delete', (_, id: string) => {
    sessionRepo.deleteById(db, id);
  });

  ipcMain.handle('db:sessions:deleteByDate', (_, date: string) => {
    sessionRepo.deleteByDate(db, date);
  });

  ipcMain.handle('db:sessions:deleteAll', () => {
    sessionRepo.deleteAll(db);
  });

  // Session Plans
  ipcMain.handle('db:plans:save', (_, plan) => {
    planRepo.saveWithSegments(db, plan);
  });

  ipcMain.handle('db:plans:get', (_, id: string) => {
    return planRepo.get(db, id);
  });

  ipcMain.handle('db:plans:getByDate', (_, date: string) => {
    return planRepo.getByDate(db, date);
  });

  ipcMain.handle('db:plans:getByDateRange', (_, start: string, end: string) => {
    return planRepo.getByDateRange(db, start, end);
  });

  ipcMain.handle('db:plans:update', (_, id: string, updates: any) => {
    return planRepo.update(db, id, updates);
  });

  ipcMain.handle('db:plans:updateSegment', (_, segmentId: string, updates: any) => {
    planRepo.updateSegment(db, segmentId, updates);
  });

  // Daily History
  ipcMain.handle('db:history:save', (_, history) => {
    dailyHistoryRepo.save(db, history);
  });

  ipcMain.handle('db:history:getByDate', (_, date: string) => {
    return dailyHistoryRepo.getByDate(db, date);
  });

  ipcMain.handle('db:history:getByRange', (_, start: string, end: string) => {
    return dailyHistoryRepo.getByRange(db, start, end);
  });

  ipcMain.handle('db:history:getAllDates', () => {
    return dailyHistoryRepo.getAllDates(db);
  });

  ipcMain.handle('db:history:deleteByDate', (_, date: string) => {
    dailyHistoryRepo.deleteByDate(db, date);
  });

  ipcMain.handle('db:history:deleteAll', () => {
    dailyHistoryRepo.deleteAll(db);
  });

  // Challenges
  ipcMain.handle('db:challenges:getAll', () => {
    return challengeRepo.getAll(db);
  });

  ipcMain.handle('db:challenges:getById', (_, id: string) => {
    return challengeRepo.getById(db, id);
  });

  ipcMain.handle('db:challenges:save', (_, challenge) => {
    challengeRepo.saveWithDays(db, challenge);
  });

  ipcMain.handle('db:challenges:delete', (_, id: string) => {
    challengeRepo.deleteById(db, id);
  });

  ipcMain.handle(
    'db:challenges:markDay',
    (_, challengeId: string, date: string, status: string, note?: string) => {
      challengeRepo.markDay(db, challengeId, date, status, note);
    },
  );

  // Feedback
  ipcMain.handle('db:feedback:getAll', (_, filters?: any) => {
    return feedbackRepo.getAll(db, filters);
  });

  ipcMain.handle('db:feedback:save', (_, item) => {
    feedbackRepo.insert(db, item);
  });

  ipcMain.handle('db:feedback:update', (_, id: string, updates: any) => {
    feedbackRepo.update(db, id, updates);
  });

  ipcMain.handle('db:feedback:delete', (_, id: string) => {
    feedbackRepo.deleteById(db, id);
  });

  ipcMain.handle('db:feedback:getStats', () => {
    return feedbackRepo.getStats(db);
  });

  // KV Store (AppState, LifetimeStats)
  ipcMain.handle('db:kv:get', (_, key: string) => {
    return kvRepo.get(db, key);
  });

  ipcMain.handle('db:kv:set', (_, key: string, value: any) => {
    kvRepo.set(db, key, value);
  });

  // Active Snapshot (crash recovery)
  ipcMain.handle('db:snapshot:save', (_, plan) => {
    snapshotRepo.save(db, plan);
  });

  ipcMain.handle('db:snapshot:load', () => {
    return snapshotRepo.load(db);
  });

  ipcMain.handle('db:snapshot:clear', () => {
    snapshotRepo.clear(db);
  });

  // Compound operations
  ipcMain.handle('db:sessions:saveAndUpdateHistory', (_, session, historyData) => {
    db.transaction(() => {
      sessionRepo.insert(db, session);
      if (historyData) {
        dailyHistoryRepo.save(db, historyData);
      }
    })();
  });

  ipcMain.handle('db:history:clearToday', (_, date: string) => {
    db.transaction(() => {
      dailyHistoryRepo.deleteByDate(db, date);
      sessionRepo.deleteByDate(db, date);
    })();
  });

  ipcMain.handle('db:history:resetAll', () => {
    db.transaction(() => {
      sessionRepo.deleteAll(db);
      dailyHistoryRepo.deleteAll(db);
    })();
  });
}
