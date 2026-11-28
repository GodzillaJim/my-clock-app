import type { SessionRecord } from '@/features/timer/types';
import { utcDate } from '@/features/stats/stats';
import type { FocusDb } from '../db';
import type { HistoryService } from './history';

/** Finished focus and break sessions. */
export function createSessionService(db: FocusDb, history: HistoryService) {
  return {
    /** Stores a session and refreshes the summary of the day it started on. */
    async add(session: SessionRecord): Promise<void> {
      await db.sessions.save(session);
      await history.updateDay(utcDate(new Date(session.startTime).getTime()));
    },
  };
}
