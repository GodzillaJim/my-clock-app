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
  PeriodSummary
} from '@/features/timer/types';
import { FeedbackItem } from '@/types/feedback';
import { createStorageService } from './storage';

class FocusStorageService {
  // Legacy storage services (browser fallback)
  private appStateStorage = createStorageService<AppState>('focus_sessions_app_state');
  private sessionsStorage = createStorageService<SessionRecord[]>('focus_sessions_sessions');
  private dailyHistoryStorage = createStorageService<DailyHistory[]>('focus_sessions_daily_history');
  private feedbackStorage = createStorageService<FeedbackItem[]>('focus_sessions_feedback');
  private challengeStorage = createStorageService<Challenge[]>('focus_sessions_challenges');
  private plansStorage = createStorageService<SessionPlan[]>('focus_sessions_plans');
  private lifetimeStatsStorage = createStorageService<LifetimeStats>('focus_sessions_lifetime_stats');

  // SQLite via Electron IPC when available
  private get useDb(): boolean {
    return !!window.electronAPI?.db;
  }

  private get db() {
    return window.electronAPI!.db;
  }

  async initialize(): Promise<void> {
    console.log(`FocusStorageService initialized (${this.useDb ? 'SQLite' : 'localStorage'})`);
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
      lastActiveDate: getTodayDateString()
    };

    try {
      let loadedState: AppState | null = null;

      if (this.useDb) {
        loadedState = await this.db.kv.get('app_state');
      } else {
        loadedState = await this.appStateStorage.load();
      }

      if (loadedState) {
        const state: AppState = {
          ...defaultState,
          ...loadedState,
          settings: { ...DEFAULT_SETTINGS, ...loadedState.settings }
        };
        if (state.lastActiveDate !== getTodayDateString()) {
          state.currentSession = null;
          state.lastActiveDate = getTodayDateString();
        }
        return state;
      }
      return defaultState;
    } catch (error) {
      console.error('Failed to get app state:', error);
      return defaultState;
    }
  }

  async saveAppState(state: AppState): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.kv.set('app_state', state);
      } else {
        await this.appStateStorage.save(state);
      }
    } catch (error) {
      console.error('Failed to save app state:', error);
      throw error;
    }
  }

  // ============================================
  // Sessions
  // ============================================

  async saveSession(session: SessionRecord): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.sessions.save(session);
      } else {
        const sessions = await this.sessionsStorage.load() || [];
        sessions.push(session);
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        await this.sessionsStorage.save(sessions.filter(s => new Date(s.startTime).getTime() >= cutoff));
      }
      await this.updateDailyStats(getTodayDateString());
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async addSession(session: SessionRecord): Promise<void> {
    return this.saveSession(session);
  }

  async getSessionHistory(limit: number = 50): Promise<SessionRecord[]> {
    try {
      if (this.useDb) {
        return await this.db.sessions.getHistory(limit);
      }
      const sessions = await this.sessionsStorage.load() || [];
      return sessions
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get session history:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.sessions.delete(sessionId);
      } else {
        const sessions = await this.sessionsStorage.load() || [];
        await this.sessionsStorage.save(sessions.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  async getSessionStats(): Promise<SessionStats> {
    try {
      if (this.useDb) {
        const sessions = await this.db.sessions.getHistory();
        return this.calculateStats(sessions);
      }
      const sessions = await this.sessionsStorage.load() || [];
      return this.calculateStats(sessions);
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return this.calculateStats([]);
    }
  }

  private calculateStats(sessions: SessionRecord[]): SessionStats {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.completionStatus === CompletionStatus.COMPLETED);
    const focusSessions = sessions.filter(s => s.type === SessionType.FOCUS);
    const totalFocusSeconds = focusSessions.reduce((sum, s) => sum + s.actualDuration, 0);
    const totalBreakSeconds = sessions.filter(s => s.type !== SessionType.FOCUS).reduce((sum, s) => sum + s.actualDuration, 0);

    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
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

    const avgSeconds = totalSessions > 0 ? (totalFocusSeconds + totalBreakSeconds) / totalSessions : 0;
    const completionRate = focusSessions.length > 0
      ? focusSessions.filter(s => s.completionStatus === CompletionStatus.COMPLETED).length / focusSessions.length
      : 0;

    return {
      totalFocusTime: formatDurationFromSeconds(totalFocusSeconds),
      completedSessions: completedSessions.length,
      currentStreak,
      todayProgress: Math.round(completionRate * 100),
      averageSessionTime: formatDurationFromSeconds(avgSeconds)
    };
  }

  // ============================================
  // Daily History
  // ============================================

  async getTodayHistory(): Promise<DailyHistory> {
    const today = getTodayDateString();
    const defaultHistory: DailyHistory = {
      date: today, sessions: [], totalFocusTime: 0, totalBreakTime: 0,
      completedSessions: 0, interruptedSessions: 0, skippedSessions: 0,
      averageSessionLength: 0, longestStreak: 0,
      createdAt: new Date(), updatedAt: new Date(),
      dayStartTime: null, dayEndTime: null, sessionPlanIds: [],
      totalPlannedTime: 0, totalActualTime: 0, completionRate: 0
    };

    try {
      if (this.useDb) {
        const history = await this.db.history.getByDate(today);
        if (history) {
          // Populate sessions from sessions table
          history.sessions = await this.db.sessions.getByDate(today);
          return history;
        }
        return defaultHistory;
      }
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.find(h => h.date === today) || defaultHistory;
    } catch (error) {
      console.error('Failed to get today history:', error);
      return defaultHistory;
    }
  }

  async saveDailyHistory(history: DailyHistory): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.history.save(history);
      } else {
        const histories = await this.dailyHistoryStorage.load() || [];
        const existingIndex = histories.findIndex(h => h.date === history.date);
        if (existingIndex >= 0) {
          histories[existingIndex] = history;
        } else {
          histories.push(history);
        }
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        await this.dailyHistoryStorage.save(histories.filter(h => new Date(h.date) >= ninetyDaysAgo));
      }
    } catch (error) {
      console.error('Failed to save daily history:', error);
      throw error;
    }
  }

  async updateDailyStats(date: string): Promise<void> {
    try {
      let daySessions: SessionRecord[];

      if (this.useDb) {
        daySessions = await this.db.sessions.getByDate(date);
      } else {
        const sessions = await this.sessionsStorage.load() || [];
        const dayStartTime = new Date(`${date}T00:00:00.000Z`).getTime();
        const dayEndTime = new Date(`${date}T23:59:59.999Z`).getTime();
        daySessions = sessions.filter(session => {
          const sessionTime = new Date(session.startTime).getTime();
          return sessionTime >= dayStartTime && sessionTime <= dayEndTime;
        });
      }

      const completedSessions = daySessions.filter(s => s.completionStatus === CompletionStatus.COMPLETED);
      const totalFocusSeconds = daySessions.filter(s => s.type === SessionType.FOCUS).reduce((sum, s) => sum + s.actualDuration, 0);
      const totalBreakSeconds = daySessions.filter(s => s.type !== SessionType.FOCUS).reduce((sum, s) => sum + s.actualDuration, 0);

      let longestStreak = 0;
      let currentStreak = 0;
      const sortedSessions = [...daySessions].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      for (const session of sortedSessions) {
        if (session.type === SessionType.FOCUS && session.completionStatus === CompletionStatus.COMPLETED) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (session.type === SessionType.FOCUS) {
          currentStreak = 0;
        }
      }

      const sessionTimes = sortedSessions
        .map(s => new Date(s.startTime).getTime())
        .filter(t => !isNaN(t));
      const endTimes = sortedSessions
        .map(s => s.endTime ? new Date(s.endTime).getTime() : null)
        .filter((t): t is number => t !== null && !isNaN(t));
      const dayStart = sessionTimes.length > 0 ? Math.min(...sessionTimes) : null;
      const dayEnd = endTimes.length > 0 ? Math.max(...endTimes) : null;

      const plans: SessionPlan[] = await this.getPlansForDate(date);
      const planIds = plans.map((p: SessionPlan) => p.id);
      const totalPlanned = plans.reduce((sum: number, p: SessionPlan) => sum + p.totalPlannedDuration, 0);
      const totalActual = plans.reduce((sum: number, p: SessionPlan) => sum + p.totalElapsed, 0);
      const totalSegments = plans.reduce((sum: number, p: SessionPlan) => sum + p.segments.length, 0);
      const completedSegments = plans.reduce((sum: number, p: SessionPlan) =>
        sum + p.segments.filter(s => s.status === 'completed').length, 0);

      const existingHistory = await this.getHistoryByDate(date);

      const history: DailyHistory = {
        date,
        sessions: daySessions,
        totalFocusTime: totalFocusSeconds,
        totalBreakTime: totalBreakSeconds,
        completedSessions: completedSessions.length,
        interruptedSessions: daySessions.filter(s => s.completionStatus === CompletionStatus.INTERRUPTED).length,
        skippedSessions: daySessions.filter(s => s.completionStatus === CompletionStatus.SKIPPED).length,
        averageSessionLength: daySessions.length > 0 ? totalFocusSeconds / daySessions.length : 0,
        longestStreak,
        createdAt: existingHistory?.createdAt || new Date(),
        updatedAt: new Date(),
        dayStartTime: dayStart,
        dayEndTime: dayEnd,
        sessionPlanIds: planIds,
        totalPlannedTime: totalPlanned,
        totalActualTime: totalActual,
        completionRate: totalSegments > 0 ? completedSegments / totalSegments : 0
      };

      await this.saveDailyHistory(history);
    } catch (error) {
      console.error('Failed to update daily stats:', error);
      throw error;
    }
  }

  async getHistoryForPeriod(startDate: string, endDate: string): Promise<DailyHistory[]> {
    try {
      if (this.useDb) {
        return await this.db.history.getByRange(startDate, endDate);
      }
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.filter(h => h.date >= startDate && h.date <= endDate);
    } catch (error) {
      console.error('Failed to get history for period:', error);
      return [];
    }
  }

  async getAllHistoryDates(): Promise<string[]> {
    try {
      if (this.useDb) {
        return await this.db.history.getAllDates();
      }
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.map(h => h.date).sort((a, b) => b.localeCompare(a));
    } catch (error) {
      console.error('Failed to get history dates:', error);
      return [];
    }
  }

  async getHistoryByDate(date: string): Promise<DailyHistory | null> {
    try {
      if (this.useDb) {
        const history = await this.db.history.getByDate(date);
        if (history) {
          history.sessions = await this.db.sessions.getByDate(date);
        }
        return history;
      }
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.find(h => h.date === date) || null;
    } catch (error) {
      console.error('Failed to get history by date:', error);
      return null;
    }
  }

  async clearTodayHistory(): Promise<void> {
    const today = getTodayDateString();
    try {
      if (this.useDb) {
        await this.db.history.clearToday(today);
      } else {
        const histories = await this.dailyHistoryStorage.load() || [];
        await this.dailyHistoryStorage.save(histories.filter(h => h.date !== today));
        const sessions = await this.sessionsStorage.load() || [];
        const dayStartTime = new Date(`${today}T00:00:00.000Z`).getTime();
        const dayEndTime = new Date(`${today}T23:59:59.999Z`).getTime();
        await this.sessionsStorage.save(sessions.filter(session => {
          const t = new Date(session.startTime).getTime();
          return !(t >= dayStartTime && t <= dayEndTime);
        }));
      }
    } catch (error) {
      console.error('Failed to clear today history:', error);
      throw error;
    }
  }

  async resetAllHistory(): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.history.resetAll();
      } else {
        await this.sessionsStorage.save([]);
        await this.dailyHistoryStorage.save([]);
      }
    } catch (error) {
      console.error('Failed to reset all history:', error);
      throw error;
    }
  }

  async exportHistory(startDate: string, endDate: string, format: 'csv' | 'json'): Promise<string> {
    const histories = await this.getHistoryForPeriod(startDate, endDate);
    if (format === 'json') {
      return JSON.stringify(histories, null, 2);
    }
    const headers = ['date', 'totalFocusTime', 'totalBreakTime', 'completedSessions', 'interruptedSessions', 'skippedSessions'];
    const rows = histories.map(h => [
      h.date, h.totalFocusTime, h.totalBreakTime, h.completedSessions, h.interruptedSessions, h.skippedSessions
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // ============================================
  // Session Plan Methods
  // ============================================

  async saveSessionPlan(plan: SessionPlan): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.plans.save(plan);
      } else {
        const plans = await this.plansStorage.load() || [];
        const existingIndex = plans.findIndex(p => p.id === plan.id);
        if (existingIndex >= 0) {
          plans[existingIndex] = plan;
        } else {
          plans.push(plan);
        }
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        await this.plansStorage.save(plans.filter(p => p.createdAt >= ninetyDaysAgo));
      }
    } catch (error) {
      console.error('Failed to save session plan:', error);
      throw error;
    }
  }

  async getSessionPlan(id: string): Promise<SessionPlan | null> {
    try {
      if (this.useDb) {
        return await this.db.plans.get(id);
      }
      const plans = await this.plansStorage.load() || [];
      return plans.find(p => p.id === id) || null;
    } catch (error) {
      console.error('Failed to get session plan:', error);
      return null;
    }
  }

  async getPlansForDate(date: string): Promise<SessionPlan[]> {
    try {
      if (this.useDb) {
        return await this.db.plans.getByDate(date);
      }
      const plans = await this.plansStorage.load() || [];
      const dayStart = new Date(`${date}T00:00:00`).getTime();
      const dayEnd = new Date(`${date}T23:59:59.999`).getTime();
      return plans.filter(p => p.createdAt >= dayStart && p.createdAt <= dayEnd);
    } catch (error) {
      console.error('Failed to get plans for date:', error);
      return [];
    }
  }

  async getPlansForPeriod(startDate: string, endDate: string): Promise<SessionPlan[]> {
    try {
      if (this.useDb) {
        return await this.db.plans.getByDateRange(startDate, endDate);
      }
      const plans = await this.plansStorage.load() || [];
      const start = new Date(`${startDate}T00:00:00`).getTime();
      const end = new Date(`${endDate}T23:59:59.999`).getTime();
      return plans.filter(p => p.createdAt >= start && p.createdAt <= end);
    } catch (error) {
      console.error('Failed to get plans for period:', error);
      return [];
    }
  }

  async updateSessionPlan(id: string, updates: Partial<SessionPlan>): Promise<SessionPlan | null> {
    try {
      if (this.useDb) {
        return await this.db.plans.update(id, updates);
      }
      const plans = await this.plansStorage.load() || [];
      const index = plans.findIndex(p => p.id === id);
      if (index === -1) return null;
      plans[index] = { ...plans[index], ...updates, lastUpdated: Date.now() };
      await this.plansStorage.save(plans);
      return plans[index];
    } catch (error) {
      console.error('Failed to update session plan:', error);
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
      const orphaned = plans.filter(p => p.status === 'active');
      if (orphaned.length === 0) return [];

      const affectedDates = new Set<string>();

      for (const plan of orphaned) {
        const interruptedAt = plan.lastUpdated || plan.createdAt || Date.now();
        const segIdx = plan.currentSegmentIndex;

        const segments = plan.segments.map((seg, idx) => {
          if (idx === segIdx && (seg.status === 'in_progress' || seg.status === 'pending')) {
            const elapsed = seg.actualStartTime
              ? Math.max(0, Math.round((interruptedAt - seg.actualStartTime) / 1000))
              : (seg.elapsedAtLastUpdate || 0);
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
        await this.updateDailyStats(date).catch(err =>
          console.error('Failed to update stats after reconcile:', err));
      }
      await this.recalculateLifetimeStats().catch(err =>
        console.error('Failed to recalculate stats after reconcile:', err));

      return orphaned;
    } catch (error) {
      console.error('Failed to reconcile orphaned plans:', error);
      return [];
    }
  }

  // ============================================
  // Lifetime Stats Methods
  // ============================================

  async getLifetimeStats(): Promise<LifetimeStats> {
    try {
      if (this.useDb) {
        const stats = await this.db.kv.get('lifetime_stats');
        if (stats) return stats;
      } else {
        const stats = await this.lifetimeStatsStorage.load();
        if (stats) return stats;
      }
    } catch (error) {
      console.error('Failed to get lifetime stats:', error);
    }
    return this.createDefaultLifetimeStats();
  }

  async saveLifetimeStats(stats: LifetimeStats): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.kv.set('lifetime_stats', stats);
      } else {
        await this.lifetimeStatsStorage.save(stats);
      }
    } catch (error) {
      console.error('Failed to save lifetime stats:', error);
    }
  }

  async recalculateLifetimeStats(): Promise<LifetimeStats> {
    let histories: DailyHistory[];

    if (this.useDb) {
      // Get all history dates and load them
      const dates = await this.db.history.getAllDates();
      if (dates.length === 0) {
        const stats = this.createDefaultLifetimeStats();
        await this.saveLifetimeStats(stats);
        return stats;
      }
      const oldest = dates[dates.length - 1];
      const newest = dates[0];
      histories = await this.db.history.getByRange(oldest, newest);
      // Populate session counts from sessions table for active day detection
      for (const h of histories) {
        if (!h.sessions || h.sessions.length === 0) {
          h.sessions = await this.db.sessions.getByDate(h.date);
        }
      }
    } else {
      histories = await this.dailyHistoryStorage.load() || [];
    }

    const now = Date.now();
    const activeDays = histories.filter(h => h.sessions && h.sessions.length > 0);

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
      .filter(h => h.completedSessions > 0)
      .map(h => h.date)
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
    let checkDate = new Date(today);
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

    const focusSessions = totalSessions > 0
      ? activeDays.reduce((sum, h) =>
          sum + (h.sessions?.filter(s => s.type === SessionType.FOCUS).length || 0), 0)
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
      averageSessionDuration: totalSessions > 0 ? (totalFocusTime + totalBreakTime) / totalSessions : 0,
      currentDayStreak,
      longestDayStreak,
      overallCompletionRate: completionRate,
      totalInterruptedSessions: totalInterrupted,
      last7Days: last7,
      last30Days: last30
    };

    await this.saveLifetimeStats(stats);
    return stats;
  }

  private computePeriodSummary(histories: DailyHistory[], days: number): PeriodSummary {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const period = histories.filter(h => h.date >= cutoffStr);
    const active = period.filter(h => h.sessions && h.sessions.length > 0);

    const totalFocusTime = active.reduce((sum, h) => sum + (h.totalFocusTime || 0), 0);
    const totalSessions = active.reduce((sum, h) => sum + (h.sessions?.length || 0), 0);
    const totalCompleted = active.reduce((sum, h) => sum + (h.completedSessions || 0), 0);
    const focusSessions = active.reduce((sum, h) =>
      sum + (h.sessions?.filter(s => s.type === SessionType.FOCUS).length || 0), 0);

    return {
      totalFocusTime,
      totalSessions,
      averageDailyFocusTime: active.length > 0 ? totalFocusTime / active.length : 0,
      completionRate: focusSessions > 0 ? totalCompleted / focusSessions : 0,
      daysActive: active.length
    };
  }

  private createDefaultLifetimeStats(): LifetimeStats {
    const emptyPeriod: PeriodSummary = {
      totalFocusTime: 0, totalSessions: 0, averageDailyFocusTime: 0,
      completionRate: 0, daysActive: 0
    };
    return {
      lastUpdated: 0, totalDaysActive: 0, totalSessions: 0,
      totalFocusTime: 0, totalBreakTime: 0,
      averageDayStartTime: '--:--', averageDayEndTime: '--:--',
      averageDailyFocusTime: 0, averageDailySessionCount: 0, averageSessionDuration: 0,
      currentDayStreak: 0, longestDayStreak: 0,
      overallCompletionRate: 0, totalInterruptedSessions: 0,
      last7Days: emptyPeriod, last30Days: emptyPeriod
    };
  }

  // ============================================
  // Feedback Methods
  // ============================================

  async addFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'status'>): Promise<void> {
    const newFeedback: FeedbackItem = {
      ...feedback,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      status: 'open'
    };
    try {
      if (this.useDb) {
        await this.db.feedback.save(newFeedback);
      } else {
        const feedbacks = await this.feedbackStorage.load() || [];
        feedbacks.push(newFeedback);
        await this.feedbackStorage.save(feedbacks);
      }
    } catch (error) {
      console.error('Failed to add feedback:', error);
      throw error;
    }
  }

  async getFeedback(filters?: {
    type?: string;
    status?: string;
    severity?: 'low' | 'medium' | 'high';
    limit?: number;
  }): Promise<FeedbackItem[]> {
    try {
      if (this.useDb) {
        return await this.db.feedback.getAll(filters);
      }
      const feedbacks = await this.feedbackStorage.load() || [];
      let filtered = feedbacks.map(f => ({ ...f, timestamp: new Date(f.timestamp) }));
      if (filters?.type) filtered = filtered.filter(f => f.type === filters.type);
      if (filters?.status) filtered = filtered.filter(f => f.status === filters.status);
      if (filters?.severity) filtered = filtered.filter(f => f.severity === filters.severity);
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (filters?.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch (error) {
      console.error('Failed to get feedback:', error);
      return [];
    }
  }

  async updateFeedback(id: string, updates: Partial<Pick<FeedbackItem, 'status'>>): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.feedback.update(id, updates);
      } else {
        const feedbacks = await this.feedbackStorage.load() || [];
        const index = feedbacks.findIndex(f => f.id === id);
        if (index >= 0) {
          feedbacks[index] = { ...feedbacks[index], ...updates };
          await this.feedbackStorage.save(feedbacks);
        }
      }
    } catch (error) {
      console.error('Failed to update feedback:', error);
      throw error;
    }
  }

  async deleteFeedback(id: string): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.feedback.delete(id);
      } else {
        const feedbacks = await this.feedbackStorage.load() || [];
        await this.feedbackStorage.save(feedbacks.filter(f => f.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete feedback:', error);
      throw error;
    }
  }

  async getFeedbackStats(): Promise<any> {
    try {
      if (this.useDb) {
        return await this.db.feedback.getStats();
      }
    } catch (error) {
      console.error('Failed to get feedback stats:', error);
    }
    const feedbacks = await this.feedbackStorage.load() || [];
    return {
      total: feedbacks.length,
      open: feedbacks.filter(f => f.status === 'open').length,
      resolved: feedbacks.filter(f => f.status === 'resolved').length,
      inProgress: feedbacks.filter(f => f.status === 'in-progress').length,
      byType: {
        bug: feedbacks.filter(f => f.type === 'bug').length,
        'feature-request': feedbacks.filter(f => f.type === 'feature-request').length,
        issue: feedbacks.filter(f => f.type === 'issue').length,
        general: feedbacks.filter(f => f.type === 'general').length
      },
      bySeverity: {
        low: feedbacks.filter(f => f.severity === 'low').length,
        medium: feedbacks.filter(f => f.severity === 'medium').length,
        high: feedbacks.filter(f => f.severity === 'high').length,
        critical: feedbacks.filter(f => f.severity === 'critical').length
      }
    };
  }

  async updateFeedbackStatus(id: string, status: 'open' | 'in-progress' | 'resolved' | 'dismissed'): Promise<void> {
    return this.updateFeedback(id, { status });
  }

  async exportFeedback(format: 'csv' | 'json'): Promise<string> {
    const feedbacks = await this.getFeedback();
    if (format === 'json') {
      return JSON.stringify(feedbacks, null, 2);
    }
    const headers = ['id', 'type', 'title', 'description', 'severity', 'category', 'timestamp', 'status'];
    const rows = feedbacks.map(f => [
      f.id, f.type, f.title, f.description, f.severity, f.category,
      new Date(f.timestamp).toISOString(), f.status
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // ============================================
  // Challenge Methods
  // ============================================

  async getChallenges(): Promise<Challenge[]> {
    try {
      if (this.useDb) {
        return await this.db.challenges.getAll();
      }
      const challenges = await this.challengeStorage.load() || [];
      return challenges.map(c => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        days: c.days.map(d => ({
          ...d,
          markedAt: d.markedAt ? new Date(d.markedAt) : undefined
        }))
      }));
    } catch (error) {
      console.error('Failed to get challenges:', error);
      return [];
    }
  }

  async getActiveChallenges(): Promise<Challenge[]> {
    const challenges = await this.getChallenges();
    return challenges.filter(c => c.status === ChallengeStatus.ACTIVE);
  }

  async getChallengeById(id: string): Promise<Challenge | null> {
    try {
      if (this.useDb) {
        return await this.db.challenges.getById(id);
      }
    } catch (error) {
      console.error('Failed to get challenge by id:', error);
    }
    const challenges = await this.getChallenges();
    return challenges.find(c => c.id === id) || null;
  }

  async createChallenge(challenge: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'completedDays' | 'failedDays' | 'currentStreak' | 'longestStreak'>): Promise<Challenge> {
    const newChallenge: Challenge = {
      ...challenge,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      completedDays: 0,
      failedDays: 0,
      currentStreak: 0,
      longestStreak: 0
    };

    try {
      if (this.useDb) {
        await this.db.challenges.save(newChallenge);
      } else {
        const challenges = await this.getChallenges();
        challenges.push(newChallenge);
        await this.challengeStorage.save(challenges);
      }
    } catch (error) {
      console.error('Failed to create challenge:', error);
      throw error;
    }

    return newChallenge;
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<Challenge | null> {
    const challenges = await this.getChallenges();
    const index = challenges.findIndex(c => c.id === id);
    if (index === -1) return null;

    challenges[index] = { ...challenges[index], ...updates, updatedAt: new Date() };
    this.recalculateChallengeStats(challenges[index]);

    try {
      if (this.useDb) {
        await this.db.challenges.save(challenges[index]);
      } else {
        await this.challengeStorage.save(challenges);
      }
    } catch (error) {
      console.error('Failed to update challenge:', error);
      throw error;
    }

    return challenges[index];
  }

  async markChallengeDay(
    challengeId: string,
    date: string,
    status: ChallengeDayStatus,
    note?: string
  ): Promise<Challenge | null> {
    const challenges = await this.getChallenges();
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return null;

    const dayIndex = challenge.days.findIndex(d => d.date === date);
    if (dayIndex === -1) return null;

    challenge.days[dayIndex] = {
      ...challenge.days[dayIndex],
      status,
      note,
      markedAt: new Date()
    };

    challenge.updatedAt = new Date();
    this.recalculateChallengeStats(challenge);

    const today = new Date().toISOString().split('T')[0];
    if (challenge.endDate < today) {
      const allMarked = challenge.days.every(d => d.status !== ChallengeDayStatus.PENDING);
      if (allMarked) {
        const successRate = challenge.completedDays / challenge.days.length;
        challenge.status = successRate >= 0.8 ? ChallengeStatus.COMPLETED : ChallengeStatus.FAILED;
      }
    }

    try {
      if (this.useDb) {
        await this.db.challenges.save(challenge);
      } else {
        await this.challengeStorage.save(challenges);
      }
    } catch (error) {
      console.error('Failed to mark challenge day:', error);
      throw error;
    }

    return challenge;
  }

  async deleteChallenge(id: string): Promise<void> {
    try {
      if (this.useDb) {
        await this.db.challenges.delete(id);
      } else {
        const challenges = await this.getChallenges();
        await this.challengeStorage.save(challenges.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete challenge:', error);
      throw error;
    }
  }

  private recalculateChallengeStats(challenge: Challenge): void {
    const completedDays = challenge.days.filter(d => d.status === ChallengeDayStatus.COMPLETED);
    const failedDays = challenge.days.filter(d => d.status === ChallengeDayStatus.FAILED);
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

  // ============================================
  // Migration
  // ============================================

  async migrateFromIndexedDB(): Promise<void> {
    console.log('Migration handled by SQLite migration system');
  }
}

export const focusStorage = new FocusStorageService();
