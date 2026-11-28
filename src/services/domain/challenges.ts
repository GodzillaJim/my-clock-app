import type { Challenge, ChallengeDayStatus } from '@/features/timer/types';
import { challengeProgress, challengeStatus, utcDate } from '@/features/stats/stats';
import type { FocusDb } from '../db';
import { createLogger } from '@/services/logger';

const log = createLogger('challenges');

export type NewChallenge = Omit<
  Challenge,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'completedDays'
  | 'failedDays'
  | 'currentStreak'
  | 'longestStreak'
>;

/** Multi-day habit challenges and their daily check-ins. */
export function createChallengeService(db: FocusDb) {
  return {
    async list(): Promise<Challenge[]> {
      try {
        return await db.challenges.getAll();
      } catch (error) {
        log.error('Failed to load challenges:', error);
        return [];
      }
    },

    async byId(id: string): Promise<Challenge | null> {
      try {
        return await db.challenges.getById(id);
      } catch (error) {
        log.error('Failed to load challenge:', error);
        return null;
      }
    },

    async create(input: NewChallenge): Promise<Challenge> {
      const now = new Date();
      const challenge: Challenge = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        completedDays: 0,
        failedDays: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
      await db.challenges.save(challenge);
      return challenge;
    },

    /** Records a day's outcome, then updates the streaks and, once over, the status. */
    async markDay(
      id: string,
      date: string,
      status: ChallengeDayStatus,
      note?: string,
    ): Promise<Challenge | null> {
      const challenge = await db.challenges.getById(id);
      const index = challenge?.days.findIndex((d) => d.date === date) ?? -1;
      if (!challenge || index === -1) return null;

      const now = new Date();
      challenge.days[index] = { ...challenge.days[index], status, note, markedAt: now };
      const updated: Challenge = { ...challenge, ...challengeProgress(challenge), updatedAt: now };
      updated.status = challengeStatus(updated, utcDate(now.getTime()));
      await db.challenges.save(updated);
      return updated;
    },

    async remove(id: string): Promise<void> {
      await db.challenges.delete(id);
    },
  };
}
