import {
  AppState,
  DailyHistory,
  SessionRecord,
  DEFAULT_SETTINGS,
  SessionType,
  CompletionStatus,
  getTodayDateString,
  SessionStats,
  formatDurationFromSeconds,
  Challenge,
  ChallengeStatus,
  ChallengeDayStatus,
  SessionPlan,
  SegmentStatus,
  LifetimeStats,
  PeriodSummary,
} from '@/features/timer/types';
import { db as defaultDb, type FocusDb } from './db';
import { createLogger } from '@/services/logger';

const log = createLogger('focusStorage');

/**
 * Domain operations over the app's data store (SQLite via the bridge, ADR 0002).
 * Takes the store as a parameter so tests can pass an in-memory one.
 */
export class FocusStorageService {
  constructor(private readonly db: FocusDb) {}

  async initialize(): Promise<void> {
    log.info('FocusStorageService initialized');
  }

  // ============================================
  // App State
  // ============================================

  async getAppState(): Promise<AppState> {
    const defaultState: AppState = {
      version: '1.0.0',
      currentSession: null,
      dailyHistory: null,
      settings: DEFAULT_SETTINGS,
      lastActiveDate: getTodayDateString(),
    };

    try {
      const loadedState = await this.db.kv.get('app_state');

      if (loadedState) {
        const state: AppState = {
          ...defaultState,
          ...loadedState,
          settings: { ...DEFAULT_SETTINGS, ...loadedState.settings },
        };
        if (state.lastActiveDate !== getTodayDateString()) {
          state.currentSession = null;
          state.lastActiveDate = getTodayDateString();
        }
        return state;
      }
      return defaultState;
    } catch (error) {
      log.error('Failed to get app state:', error);
      return defaultState;
    }
  }

  async saveAppState(state: AppState): Promise<void> {
    try {
      await this.db.kv.set('app_state', state);
    } catch (error) {
      log.error('Failed to save app state:', error);
      throw error;
    }
  }

  // ============================================
  // Sessions
  // ============================================

  async saveSession(session: SessionRecord): Promise<void> {
    try {
      await this.db.sessions.save(session);
      await this.updateDailyStats(getTodayDateString());
    } catch (error) {
      log.error('Failed to save session:', error);
      throw error;
    }
  }

  async addSession(session: SessionRecord): Promise<void> {
    return this.saveSession(session);
  }

  async getSessionHistory(limit: number = 50): Promise<SessionRecord[]> {
    try {
      return await this.db.sessions.getHistory(limit);
    } catch (error) {
      log.error('Failed to get session history:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.db.sessions.delete(sessionId);
    } catch (error) {
      log.error('Failed to delete session:', error);
      throw error;
    }
  }

  async getSessionStats(): Promise<SessionStats> {
    try {
      return this.calculateStats(await this.db.sessions.getHistory());
    } catch (error) {
      log.error('Failed to get session stats:', error);
      return this.calculateStats([]);
    }
  }

  private calculateStats(sessions: SessionRecord[]): SessionStats {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(
      (s) => s.completionStatus === CompletionStatus.COMPLETED,
    );
    const focusSessions = sessions.filter((s) => s.type === SessionType.FOCUS);
    const totalFocusSeconds = focusSessions.reduce((sum, s) => sum + s.actualDuration, 0);
    const totalBreakSeconds = sessions
      .filter((s) => s.type !== SessionType.FOCUS)
      .reduce((sum, s) => sum + s.actualDuration, 0);

    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    let currentStreak = 0;
    for (let i = sortedSessions.length - 1; i >= 0; i--) {
      const s = sortedSessions[i];
      if (s.type === SessionType.FOCUS && s.completionStatus === CompletionStatus.COMPLETED) {
        currentStreak++;
      } else if (s.type === SessionType.FOCUS) {
        break;
      }
    }

    let longestStreak = 0;
    let tempStreak = 0;
    for (const s of sortedSessions) {
      if (s.type === SessionType.FOCUS && s.completionStatus === CompletionStatus.COMPLETED) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (s.type === SessionType.FOCUS) {
        tempStreak = 0;
      }
    }

    const avgSeconds =
      totalSessions > 0 ? (totalFocusSeconds + totalBreakSeconds) / totalSessions : 0;
    const completionRate =
      focusSessions.length > 0
        ? focusSessions.filter((s) => s.completionStatus === CompletionStatus.COMPLETED).length /
          focusSessions.length
        : 0;

    return {
      totalFocusTime: formatDurationFromSeconds(totalFocusSeconds),
      completedSessions: completedSessions.length,
      currentStreak,
      todayProgress: Math.round(completionRate * 100),
      averageSessionTime: formatDurationFromSeconds(avgSeconds),
    };
  }

  // ============================================
  // Daily History
  // ============================================

  async getTodayHistory(): Promise<DailyHistory> {
    const today = getTodayDateString();
    const defaultHistory: DailyHistory = {
      date: today,
      sessions: [],
      totalFocusTime: 0,
      totalBreakTime: 0,
      completedSessions: 0,
      interruptedSessions: 0,
      skippedSessions: 0,
      averageSessionLength: 0,
      longestStreak: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      dayStartTime: null,
      dayEndTime: null,
      sessionPlanIds: [],
      totalPlannedTime: 0,
      totalActualTime: 0,
      completionRate: 0,
    };

    try {
      return (await this.getHistoryByDate(today)) ?? defaultHistory;
    } catch (error) {
      log.error('Failed to get today history:', error);
      return defaultHistory;
    }
  }

  async saveDailyHistory(history: DailyHistory): Promise<void> {
    try {
      await this.db.history.save(history);
    } catch (error) {
      log.error('Failed to save daily history:', error);
      throw error;
    }
  }

  async updateDailyStats(date: string): Promise<void> {
    try {
      const daySessions = await this.db.sessions.getByDate(date);

      const completedSessions = daySessions.filter(
        (s) => s.completionStatus === CompletionStatus.COMPLETED,
      );
      const totalFocusSeconds = daySessions
        .filter((s) => s.type === SessionType.FOCUS)
        .reduce((sum, s) => sum + s.actualDuration, 0);
      const totalBreakSeconds = daySessions
        .filter((s) => s.type !== SessionType.FOCUS)
        .reduce((sum, s) => sum + s.actualDuration, 0);

      let longestStreak = 0;
      let currentStreak = 0;
      const sortedSessions = [...daySessions].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      for (const session of sortedSessions) {
        if (
          session.type === SessionType.FOCUS &&
          session.completionStatus === CompletionStatus.COMPLETED
        ) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (session.type === SessionType.FOCUS) {
          currentStreak = 0;
        }
      }

      const sessionTimes = sortedSessions
        .map((s) => new Date(s.startTime).getTime())
        .filter((t) => !isNaN(t));
      const endTimes = sortedSessions
        .map((s) => (s.endTime ? new Date(s.endTime).getTime() : null))
        .filter((t): t is number => t !== null && !isNaN(t));
      const dayStart = sessionTimes.length > 0 ? Math.min(...sessionTimes) : null;
      const dayEnd = endTimes.length > 0 ? Math.max(...endTimes) : null;

      const plans: SessionPlan[] = await this.getPlansForDate(date);
      const planIds = plans.map((p: SessionPlan) => p.id);
      const totalPlanned = plans.reduce(
        (sum: number, p: SessionPlan) => sum + p.totalPlannedDuration,
        0,
      );
      const totalActual = plans.reduce((sum: number, p: SessionPlan) => sum + p.totalElapsed, 0);
      const totalSegments = plans.reduce(
        (sum: number, p: SessionPlan) => sum + p.segments.length,
        0,
      );
      const completedSegments = plans.reduce(
        (sum: number, p: SessionPlan) =>
          sum + p.segments.filter((s) => s.status === 'completed').length,
        0,
      );

      const existingHistory = await this.getHistoryByDate(date);

      const history: DailyHistory = {
        date,
        sessions: daySessions,
        totalFocusTime: totalFocusSeconds,
        totalBreakTime: totalBreakSeconds,
        completedSessions: completedSessions.length,
        interruptedSessions: daySessions.filter(
          (s) => s.completionStatus === CompletionStatus.INTERRUPTED,
        ).length,
        skippedSessions: daySessions.filter((s) => s.completionStatus === CompletionStatus.SKIPPED)
          .length,
        averageSessionLength: daySessions.length > 0 ? totalFocusSeconds / daySessions.length : 0,
        longestStreak,
        createdAt: existingHistory?.createdAt || new Date(),
        updatedAt: new Date(),
        dayStartTime: dayStart,
        dayEndTime: dayEnd,
        sessionPlanIds: planIds,
        totalPlannedTime: totalPlanned,
        totalActualTime: totalActual,
        completionRate: totalSegments > 0 ? completedSegments / totalSegments : 0,
      };

      await this.saveDailyHistory(history);
    } catch (error) {
      log.error('Failed to update daily stats:', error);
      throw error;
    }
  }

  async getHistoryForPeriod(startDate: string, endDate: string): Promise<DailyHistory[]> {
    try {
      return await this.db.history.getByRange(startDate, endDate);
    } catch (error) {
      log.error('Failed to get history for period:', error);
      return [];
    }
  }

  async getAllHistoryDates(): Promise<string[]> {
    try {
      return await this.db.history.getAllDates();
    } catch (error) {
      log.error('Failed to get history dates:', error);
      return [];
    }
  }

  async getHistoryByDate(date: string): Promise<DailyHistory | null> {
    try {
      const history = await this.db.history.getByDate(date);
      if (history) {
        // Sessions live in their own table
        history.sessions = await this.db.sessions.getByDate(date);
      }
      return history;
    } catch (error) {
      log.error('Failed to get history by date:', error);
      return null;
    }
  }

  async clearTodayHistory(): Promise<void> {
    const today = getTodayDateString();
    try {
      await this.db.history.clearToday(today);
    } catch (error) {
      log.error('Failed to clear today history:', error);
      throw error;
    }
  }

  async resetAllHistory(): Promise<void> {
    try {
      await this.db.history.resetAll();
    } catch (error) {
      log.error('Failed to reset all history:', error);
      throw error;
    }
  }

  async exportHistory(startDate: string, endDate: string, format: 'csv' | 'json'): Promise<string> {
    const histories = await this.getHistoryForPeriod(startDate, endDate);
    if (format === 'json') {
      return JSON.stringify(histories, null, 2);
    }
    const headers = [
      'date',
      'totalFocusTime',
      'totalBreakTime',
      'completedSessions',
      'interruptedSessions',
      'skippedSessions',
    ];
    const rows = histories.map((h) => [
      h.date,
      h.totalFocusTime,
      h.totalBreakTime,
      h.completedSessions,
      h.interruptedSessions,
      h.skippedSessions,
    ]);
    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  // ============================================
  // Session Plan Methods
  // ============================================

  async saveSessionPlan(plan: SessionPlan): Promise<void> {
    try {
      await this.db.plans.save(plan);
    } catch (error) {
      log.error('Failed to save session plan:', error);
      throw error;
    }
  }

  async getSessionPlan(id: string): Promise<SessionPlan | null> {
    try {
      return await this.db.plans.get(id);
    } catch (error) {
      log.error('Failed to get session plan:', error);
      return null;
    }
  }

  async getPlansForDate(date: string): Promise<SessionPlan[]> {
    try {
      return await this.db.plans.getByDate(date);
    } catch (error) {
      log.error('Failed to get plans for date:', error);
      return [];
    }
  }

  async getPlansForPeriod(startDate: string, endDate: string): Promise<SessionPlan[]> {
    try {
      return await this.db.plans.getByDateRange(startDate, endDate);
    } catch (error) {
      log.error('Failed to get plans for period:', error);
      return [];
    }
  }

  async updateSessionPlan(id: string, updates: Partial<SessionPlan>): Promise<SessionPlan | null> {
    try {
      return await this.db.plans.update(id, updates);
    } catch (error) {
      log.error('Failed to update session plan:', error);
      return null;
    }
  }

  /**
   * Finalize any plans still marked `active` in storage — these are orphans left
   * behind by an abrupt shutdown (power loss) where the plan was never closed out.
   * Marks the in-progress segment and the plan itself as `interrupted` using the
   * last persisted elapsed time, so history/stats stay accurate and the plan
   * becomes resumable. Returns the plans that were reconciled.
   */
  async reconcileOrphanedPlans(): Promise<SessionPlan[]> {
    try {
      const toDateStr = (ms: number): string => {
        const d = new Date(ms);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const end = getTodayDateString();
      const start = toDateStr(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const plans = await this.getPlansForPeriod(start, end);
      const orphaned = plans.filter((p) => p.status === 'active');
      if (orphaned.length === 0) return [];

      const affectedDates = new Set<string>();

      for (const plan of orphaned) {
        const interruptedAt = plan.lastUpdated || plan.createdAt || Date.now();
        const segIdx = plan.currentSegmentIndex;

        const segments = plan.segments.map((seg, idx) => {
          if (idx === segIdx && (seg.status === 'in_progress' || seg.status === 'pending')) {
            const elapsed = seg.actualStartTime
              ? Math.max(0, Math.round((interruptedAt - seg.actualStartTime) / 1000))
              : seg.elapsedAtLastUpdate || 0;
            return {
              ...seg,
              status: 'interrupted' as SegmentStatus,
              actualEndTime: interruptedAt,
              actualDuration: seg.actualDuration ?? elapsed,
            };
          }
          return seg;
        });

        const totalElapsed = segments.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
        const finalized: SessionPlan = {
          ...plan,
          segments,
          status: 'interrupted',
          interruptedAt,
          actualEndTime: interruptedAt,
          totalElapsed,
          lastUpdated: Date.now(),
        };

        await this.saveSessionPlan(finalized);
        affectedDates.add(toDateStr(plan.createdAt));
      }

      for (const date of affectedDates) {
        await this.updateDailyStats(date).catch((err) =>
          log.error('Failed to update stats after reconcile:', err),
        );
      }
      await this.recalculateLifetimeStats().catch((err) =>
        log.error('Failed to recalculate stats after reconcile:', err),
      );

      return orphaned;
    } catch (error) {
      log.error('Failed to reconcile orphaned plans:', error);
      return [];
    }
  }

  // ============================================
  // Lifetime Stats Methods
  // ============================================

  async getLifetimeStats(): Promise<LifetimeStats> {
    try {
      const stats = await this.db.kv.get('lifetime_stats');
      if (stats) return stats;
    } catch (error) {
      log.error('Failed to get lifetime stats:', error);
    }
    return this.createDefaultLifetimeStats();
  }

  async saveLifetimeStats(stats: LifetimeStats): Promise<void> {
    try {
      await this.db.kv.set('lifetime_stats', stats);
    } catch (error) {
      log.error('Failed to save lifetime stats:', error);
    }
  }

  async recalculateLifetimeStats(): Promise<LifetimeStats> {
    const dates = await this.db.history.getAllDates();
    if (dates.length === 0) {
      const stats = this.createDefaultLifetimeStats();
      await this.saveLifetimeStats(stats);
      return stats;
    }
    const histories = await this.db.history.getByRange(dates[dates.length - 1], dates[0]);
    // Sessions live in their own table; load them for active-day detection
    for (const h of histories) {
      h.sessions = await this.db.sessions.getByDate(h.date);
    }

    const now = Date.now();
    const activeDays = histories.filter((h) => h.sessions && h.sessions.length > 0);

    const totalSessions = activeDays.reduce((sum, h) => sum + (h.sessions?.length || 0), 0);
    const totalFocusTime = activeDays.reduce((sum, h) => sum + (h.totalFocusTime || 0), 0);
    const totalBreakTime = activeDays.reduce((sum, h) => sum + (h.totalBreakTime || 0), 0);
    const totalCompleted = activeDays.reduce((sum, h) => sum + (h.completedSessions || 0), 0);
    const totalInterrupted = activeDays.reduce((sum, h) => sum + (h.interruptedSessions || 0), 0);

    let avgStartTime = '--:--';
    let avgEndTime = '--:--';
    const startMinutes: number[] = [];
    const endMinutes: number[] = [];

    for (const h of activeDays) {
      if (h.dayStartTime) {
        const d = new Date(h.dayStartTime);
        startMinutes.push(d.getHours() * 60 + d.getMinutes());
      }
      if (h.dayEndTime) {
        const d = new Date(h.dayEndTime);
        endMinutes.push(d.getHours() * 60 + d.getMinutes());
      }
    }

    if (startMinutes.length > 0) {
      const avg = Math.round(startMinutes.reduce((a, b) => a + b, 0) / startMinutes.length);
      avgStartTime = `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
    }
    if (endMinutes.length > 0) {
      const avg = Math.round(endMinutes.reduce((a, b) => a + b, 0) / endMinutes.length);
      avgEndTime = `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
    }

    const sortedDates = activeDays
      .filter((h) => h.completedSessions > 0)
      .map((h) => h.date)
      .sort();
    let currentDayStreak = 0;
    let longestDayStreak = 0;
    let tempStreak = 0;
    const today = getTodayDateString();

    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
      }
      longestDayStreak = Math.max(longestDayStreak, tempStreak);
    }

    currentDayStreak = 0;
    const checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (sortedDates.includes(dateStr)) {
        currentDayStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const last7 = this.computePeriodSummary(histories, 7);
    const last30 = this.computePeriodSummary(histories, 30);

    const focusSessions =
      totalSessions > 0
        ? activeDays.reduce(
            (sum, h) => sum + (h.sessions?.filter((s) => s.type === SessionType.FOCUS).length || 0),
            0,
          )
        : 0;
    const completionRate = focusSessions > 0 ? totalCompleted / focusSessions : 0;

    const stats: LifetimeStats = {
      lastUpdated: now,
      totalDaysActive: activeDays.length,
      totalSessions,
      totalFocusTime,
      totalBreakTime,
      averageDayStartTime: avgStartTime,
      averageDayEndTime: avgEndTime,
      averageDailyFocusTime: activeDays.length > 0 ? totalFocusTime / activeDays.length : 0,
      averageDailySessionCount: activeDays.length > 0 ? totalSessions / activeDays.length : 0,
      averageSessionDuration:
        totalSessions > 0 ? (totalFocusTime + totalBreakTime) / totalSessions : 0,
      currentDayStreak,
      longestDayStreak,
      overallCompletionRate: completionRate,
      totalInterruptedSessions: totalInterrupted,
      last7Days: last7,
      last30Days: last30,
    };

    await this.saveLifetimeStats(stats);
    return stats;
  }

  private computePeriodSummary(histories: DailyHistory[], days: number): PeriodSummary {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const period = histories.filter((h) => h.date >= cutoffStr);
    const active = period.filter((h) => h.sessions && h.sessions.length > 0);

    const totalFocusTime = active.reduce((sum, h) => sum + (h.totalFocusTime || 0), 0);
    const totalSessions = active.reduce((sum, h) => sum + (h.sessions?.length || 0), 0);
    const totalCompleted = active.reduce((sum, h) => sum + (h.completedSessions || 0), 0);
    const focusSessions = active.reduce(
      (sum, h) => sum + (h.sessions?.filter((s) => s.type === SessionType.FOCUS).length || 0),
      0,
    );

    return {
      totalFocusTime,
      totalSessions,
      averageDailyFocusTime: active.length > 0 ? totalFocusTime / active.length : 0,
      completionRate: focusSessions > 0 ? totalCompleted / focusSessions : 0,
      daysActive: active.length,
    };
  }

  private createDefaultLifetimeStats(): LifetimeStats {
    const emptyPeriod: PeriodSummary = {
      totalFocusTime: 0,
      totalSessions: 0,
      averageDailyFocusTime: 0,
      completionRate: 0,
      daysActive: 0,
    };
    return {
      lastUpdated: 0,
      totalDaysActive: 0,
      totalSessions: 0,
      totalFocusTime: 0,
      totalBreakTime: 0,
      averageDayStartTime: '--:--',
      averageDayEndTime: '--:--',
      averageDailyFocusTime: 0,
      averageDailySessionCount: 0,
      averageSessionDuration: 0,
      currentDayStreak: 0,
      longestDayStreak: 0,
      overallCompletionRate: 0,
      totalInterruptedSessions: 0,
      last7Days: emptyPeriod,
      last30Days: emptyPeriod,
    };
  }

  // ============================================
  // Challenge Methods
  // ============================================

  async getChallenges(): Promise<Challenge[]> {
    try {
      return await this.db.challenges.getAll();
    } catch (error) {
      log.error('Failed to get challenges:', error);
      return [];
    }
  }

  async getActiveChallenges(): Promise<Challenge[]> {
    const challenges = await this.getChallenges();
    return challenges.filter((c) => c.status === ChallengeStatus.ACTIVE);
  }

  async getChallengeById(id: string): Promise<Challenge | null> {
    try {
      return await this.db.challenges.getById(id);
    } catch (error) {
      log.error('Failed to get challenge by id:', error);
      return null;
    }
  }

  async createChallenge(
    challenge: Omit<
      Challenge,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'completedDays'
      | 'failedDays'
      | 'currentStreak'
      | 'longestStreak'
    >,
  ): Promise<Challenge> {
    const newChallenge: Challenge = {
      ...challenge,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      completedDays: 0,
      failedDays: 0,
      currentStreak: 0,
      longestStreak: 0,
    };

    try {
      await this.db.challenges.save(newChallenge);
    } catch (error) {
      log.error('Failed to create challenge:', error);
      throw error;
    }

    return newChallenge;
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<Challenge | null> {
    const challenges = await this.getChallenges();
    const index = challenges.findIndex((c) => c.id === id);
    if (index === -1) return null;

    challenges[index] = { ...challenges[index], ...updates, updatedAt: new Date() };
    this.recalculateChallengeStats(challenges[index]);

    try {
      await this.db.challenges.save(challenges[index]);
    } catch (error) {
      log.error('Failed to update challenge:', error);
      throw error;
    }

    return challenges[index];
  }

  async markChallengeDay(
    challengeId: string,
    date: string,
    status: ChallengeDayStatus,
    note?: string,
  ): Promise<Challenge | null> {
    const challenges = await this.getChallenges();
    const challenge = challenges.find((c) => c.id === challengeId);
    if (!challenge) return null;

    const dayIndex = challenge.days.findIndex((d) => d.date === date);
    if (dayIndex === -1) return null;

    challenge.days[dayIndex] = {
      ...challenge.days[dayIndex],
      status,
      note,
      markedAt: new Date(),
    };

    challenge.updatedAt = new Date();
    this.recalculateChallengeStats(challenge);

    const today = new Date().toISOString().split('T')[0];
    if (challenge.endDate < today) {
      const allMarked = challenge.days.every((d) => d.status !== ChallengeDayStatus.PENDING);
      if (allMarked) {
        const successRate = challenge.completedDays / challenge.days.length;
        challenge.status = successRate >= 0.8 ? ChallengeStatus.COMPLETED : ChallengeStatus.FAILED;
      }
    }

    try {
      await this.db.challenges.save(challenge);
    } catch (error) {
      log.error('Failed to mark challenge day:', error);
      throw error;
    }

    return challenge;
  }

  async deleteChallenge(id: string): Promise<void> {
    try {
      await this.db.challenges.delete(id);
    } catch (error) {
      log.error('Failed to delete challenge:', error);
      throw error;
    }
  }

  private recalculateChallengeStats(challenge: Challenge): void {
    const completedDays = challenge.days.filter((d) => d.status === ChallengeDayStatus.COMPLETED);
    const failedDays = challenge.days.filter((d) => d.status === ChallengeDayStatus.FAILED);
    challenge.completedDays = completedDays.length;
    challenge.failedDays = failedDays.length;

    const sortedDays = [...challenge.days].sort((a, b) => a.date.localeCompare(b.date));
    let longestStreak = 0;
    let tempStreak = 0;
    for (const day of sortedDays) {
      if (day.status === ChallengeDayStatus.COMPLETED) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (day.status === ChallengeDayStatus.FAILED) {
        tempStreak = 0;
      }
    }

    let currentStreak = 0;
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (sortedDays[i].status === ChallengeDayStatus.COMPLETED) {
        currentStreak++;
      } else if (sortedDays[i].status === ChallengeDayStatus.FAILED) {
        break;
      }
    }

    challenge.currentStreak = currentStreak;
    challenge.longestStreak = longestStreak;
  }
}

export const focusStorage = new FocusStorageService(defaultDb);
