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
  ChallengeDayStatus
} from '@/features/timer/types';
import { FeedbackItem } from '@/types/feedback';
import { createStorageService } from './storage';

class FocusStorageService {
  private appStateStorage = createStorageService<AppState>('focus_sessions_app_state');
  private sessionsStorage = createStorageService<SessionRecord[]>('focus_sessions_sessions');
  private dailyHistoryStorage = createStorageService<DailyHistory[]>('focus_sessions_daily_history');
  private feedbackStorage = createStorageService<FeedbackItem[]>('focus_sessions_feedback');
  private challengeStorage = createStorageService<Challenge[]>('focus_sessions_challenges');

  async initialize(): Promise<void> {
    // No initialization needed for file-based storage
    console.log('FocusStorageService initialized with file-based storage');
  }

  async getAppState(): Promise<AppState> {
    const defaultState: AppState = {
      version: '1.0.0',
      currentSession: null,
      dailyHistory: null,
      settings: DEFAULT_SETTINGS,
      lastActiveDate: getTodayDateString()
    };

    try {
      const loadedState = await this.appStateStorage.load();
      if (loadedState) {
        // Deep merge settings to ensure all default properties are preserved
        const state: AppState = {
          ...defaultState,
          ...loadedState,
          settings: {
            ...DEFAULT_SETTINGS,
            ...loadedState.settings
          }
        };
        
        if (state.lastActiveDate !== getTodayDateString()) {
          state.currentSession = null;
          state.lastActiveDate = getTodayDateString();
        }
        
        console.log('Loaded app state with quick presets:', state.settings.quickPresets);
        return state;
      } else {
        console.log('No saved state found, using defaults');
        return defaultState;
      }
    } catch (error) {
      console.error('Failed to get app state:', error);
      return defaultState;
    }
  }

  async saveAppState(state: AppState): Promise<void> {
    console.log('Saving app state with quick presets:', state.settings?.quickPresets);
    
    try {
      await this.appStateStorage.save(state);
      console.log('App state saved successfully');
    } catch (error) {
      console.error('Failed to save app state:', error);
      throw error;
    }
  }

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
      updatedAt: new Date()
    };

    try {
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.find(h => h.date === today) || defaultHistory;
    } catch (error) {
      console.error('Failed to get today history:', error);
      return defaultHistory;
    }
  }

  async saveDailyHistory(history: DailyHistory): Promise<void> {
    try {
      const histories = await this.dailyHistoryStorage.load() || [];
      const existingIndex = histories.findIndex(h => h.date === history.date);
      
      if (existingIndex >= 0) {
        histories[existingIndex] = history;
      } else {
        histories.push(history);
      }
      
      // Keep only last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const filteredHistories = histories.filter(h => new Date(h.date) >= thirtyDaysAgo);
      
      await this.dailyHistoryStorage.save(filteredHistories);
    } catch (error) {
      console.error('Failed to save daily history:', error);
      throw error;
    }
  }

  async saveSession(session: SessionRecord): Promise<void> {
    try {
      const sessions = await this.sessionsStorage.load() || [];
      sessions.push(session);
      const recentSessions = sessions.slice(-1000);
      await this.sessionsStorage.save(recentSessions);
      await this.updateDailyStats(getTodayDateString());
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async getSessionHistory(limit: number = 50): Promise<SessionRecord[]> {
    try {
      const sessions = await this.sessionsStorage.load() || [];
      return sessions
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get session history:', error);
      return [];
    }
  }

  private calculateStats(sessions: SessionRecord[]): SessionStats {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.completionStatus === CompletionStatus.COMPLETED);
    const focusSessions = sessions.filter(s => s.type === SessionType.FOCUS);
    const totalFocusSeconds = focusSessions.reduce((sum, s) => sum + s.actualDuration, 0);
    const totalBreakSeconds = sessions.filter(s => s.type !== SessionType.FOCUS).reduce((sum, s) => sum + s.actualDuration, 0);

    // Sort sessions by start time for accurate streak calculation
    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Current streak of completed focus sessions at end
    let currentStreak = 0;
    for (let i = sortedSessions.length - 1; i >= 0; i--) {
      const s = sortedSessions[i];
      if (s.type === SessionType.FOCUS && s.completionStatus === CompletionStatus.COMPLETED) {
        currentStreak++;
      } else if (s.type === SessionType.FOCUS) {
        // Only break on failed focus sessions, not breaks
        break;
      }
    }

    // Longest streak of completed focus sessions
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
    const productivityScore = Math.round(completionRate * 100);

    return {
      totalFocusTime: formatDurationFromSeconds(totalFocusSeconds),
      completedSessions: completedSessions.length,
      currentStreak,
      todayProgress: productivityScore,
      averageSessionTime: formatDurationFromSeconds(avgSeconds)
    };
  }

  async updateDailyStats(date: string): Promise<void> {
    try {
      const sessions = await this.sessionsStorage.load() || [];
      const dayStartTime = new Date(`${date}T00:00:00.000Z`).getTime();
      const dayEndTime = new Date(`${date}T23:59:59.999Z`).getTime();
      
      const daySessions = sessions.filter(session => {
        const sessionTime = new Date(session.startTime).getTime();
        return sessionTime >= dayStartTime && sessionTime <= dayEndTime;
      });

      const completedSessions = daySessions.filter(s => s.completionStatus === CompletionStatus.COMPLETED);
      const totalFocusSeconds = daySessions.filter(s => s.type === SessionType.FOCUS).reduce((sum, s) => sum + s.actualDuration, 0);
      const totalBreakSeconds = daySessions.filter(s => s.type !== SessionType.FOCUS).reduce((sum, s) => sum + s.actualDuration, 0);

      // Calculate longest streak of consecutive completed focus sessions
      let longestStreak = 0;
      let currentStreak = 0;
      // Sort sessions by start time to calculate streak correctly
      const sortedSessions = [...daySessions].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      for (const session of sortedSessions) {
        if (session.type === SessionType.FOCUS && session.completionStatus === CompletionStatus.COMPLETED) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (session.type === SessionType.FOCUS) {
          // Only reset streak on failed focus sessions, not breaks
          currentStreak = 0;
        }
      }

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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.saveDailyHistory(history);
    } catch (error) {
      console.error('Failed to update daily stats:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.sessionsStorage.load() || [];
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      await this.sessionsStorage.save(updatedSessions);
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  async addFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'status'>): Promise<void> {
    try {
      const feedbacks = await this.feedbackStorage.load() || [];
      const newFeedback: FeedbackItem = {
        ...feedback,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        status: 'open'
      };
      feedbacks.push(newFeedback);
      await this.feedbackStorage.save(feedbacks);
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
      const feedbacks = await this.feedbackStorage.load() || [];
      // Convert timestamp strings back to Date objects
      let filtered = feedbacks.map(f => ({
        ...f,
        timestamp: new Date(f.timestamp)
      }));

      if (filters?.type) {
        filtered = filtered.filter(f => f.type === filters.type);
      }
      if (filters?.status) {
        filtered = filtered.filter(f => f.status === filters.status);
      }
      if (filters?.severity) {
        filtered = filtered.filter(f => f.severity === filters.severity);
      }

      // Sort by timestamp (newest first)
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (filters?.limit) {
        filtered = filtered.slice(0, filters.limit);
      }

      return filtered;
    } catch (error) {
      console.error('Failed to get feedback:', error);
      return [];
    }
  }

  async updateFeedback(id: string, updates: Partial<Pick<FeedbackItem, 'status'>>): Promise<void> {
    try {
      const feedbacks = await this.feedbackStorage.load() || [];
      const index = feedbacks.findIndex(f => f.id === id);
      
      if (index >= 0) {
        feedbacks[index] = { ...feedbacks[index], ...updates };
        await this.feedbackStorage.save(feedbacks);
      }
    } catch (error) {
      console.error('Failed to update feedback:', error);
      throw error;
    }
  }

  async deleteFeedback(id: string): Promise<void> {
    try {
      const feedbacks = await this.feedbackStorage.load() || [];
      const updatedFeedbacks = feedbacks.filter(f => f.id !== id);
      await this.feedbackStorage.save(updatedFeedbacks);
    } catch (error) {
      console.error('Failed to delete feedback:', error);
      throw error;
    }
  }

  async getHistoryForPeriod(startDate: string, endDate: string): Promise<DailyHistory[]> {
    try {
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.filter(h => h.date >= startDate && h.date <= endDate);
    } catch (error) {
      console.error('Failed to get history for period:', error);
      return [];
    }
  }

  async getAllHistoryDates(): Promise<string[]> {
    try {
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories
        .map(h => h.date)
        .sort((a, b) => b.localeCompare(a)); // Sort newest first
    } catch (error) {
      console.error('Failed to get history dates:', error);
      return [];
    }
  }

  async getHistoryByDate(date: string): Promise<DailyHistory | null> {
    try {
      const histories = await this.dailyHistoryStorage.load() || [];
      return histories.find(h => h.date === date) || null;
    } catch (error) {
      console.error('Failed to get history by date:', error);
      return null;
    }
  }

  async migrateFromIndexedDB(): Promise<void> {
    // This method could be used to migrate data from the old IndexedDB storage
    // to the new file-based storage if needed
    console.log('Migration from IndexedDB not implemented - starting fresh with file-based storage');
  }

  // Additional methods for compatibility
  async addSession(session: SessionRecord): Promise<void> {
    return this.saveSession(session);
  }

  async getFeedbackStats(): Promise<any> {
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
    const feedbacks = await this.feedbackStorage.load() || [];
    if (format === 'json') {
      return JSON.stringify(feedbacks, null, 2);
    } else {
      // CSV export
      const headers = ['id', 'type', 'title', 'description', 'severity', 'category', 'timestamp', 'status'];
      const rows = feedbacks.map(f => [
        f.id, f.type, f.title, f.description, f.severity, f.category,
        new Date(f.timestamp).toISOString(), f.status
      ]);
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }

  async getSessionStats(): Promise<SessionStats> {
    const sessions = await this.sessionsStorage.load() || [];
    return this.calculateStats(sessions);
  }

  async clearTodayHistory(): Promise<void> {
    const today = getTodayDateString();
    const histories = await this.dailyHistoryStorage.load() || [];
    const filtered = histories.filter(h => h.date !== today);
    await this.dailyHistoryStorage.save(filtered);
    
    // Also clear today's sessions
    const sessions = await this.sessionsStorage.load() || [];
    const dayStartTime = new Date(`${today}T00:00:00.000Z`).getTime();
    const dayEndTime = new Date(`${today}T23:59:59.999Z`).getTime();
    
    const filteredSessions = sessions.filter(session => {
      const sessionTime = new Date(session.startTime).getTime();
      return !(sessionTime >= dayStartTime && sessionTime <= dayEndTime);
    });
    
    await this.sessionsStorage.save(filteredSessions);
  }

  async exportHistory(startDate: string, endDate: string, format: 'csv' | 'json'): Promise<string> {
    const histories = await this.getHistoryForPeriod(startDate, endDate);
    if (format === 'json') {
      return JSON.stringify(histories, null, 2);
    } else {
      // CSV export
      const headers = ['date', 'totalFocusTime', 'totalBreakTime', 'completedSessions', 'interruptedSessions', 'skippedSessions'];
      const rows = histories.map(h => [
        h.date, h.totalFocusTime, h.totalBreakTime, h.completedSessions, h.interruptedSessions, h.skippedSessions
      ]);
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }

  async resetAllHistory(): Promise<void> {
    try {
      await this.sessionsStorage.save([]);
      await this.dailyHistoryStorage.save([]);
    } catch (error) {
      console.error('Failed to reset all history:', error);
      throw error;
    }
  }

  // ============================================
  // Challenge Methods
  // ============================================

  async getChallenges(): Promise<Challenge[]> {
    try {
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

    const challenges = await this.getChallenges();
    challenges.push(newChallenge);
    await this.challengeStorage.save(challenges);

    return newChallenge;
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<Challenge | null> {
    const challenges = await this.getChallenges();
    const index = challenges.findIndex(c => c.id === id);

    if (index === -1) return null;

    challenges[index] = {
      ...challenges[index],
      ...updates,
      updatedAt: new Date()
    };

    this.recalculateChallengeStats(challenges[index]);

    await this.challengeStorage.save(challenges);
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

    // Check if challenge is complete (all days past and marked)
    const today = new Date().toISOString().split('T')[0];
    if (challenge.endDate < today) {
      const allMarked = challenge.days.every(d => d.status !== ChallengeDayStatus.PENDING);
      if (allMarked) {
        const successRate = challenge.completedDays / challenge.days.length;
        challenge.status = successRate >= 0.8 ? ChallengeStatus.COMPLETED : ChallengeStatus.FAILED;
      }
    }

    await this.challengeStorage.save(challenges);
    return challenge;
  }

  async deleteChallenge(id: string): Promise<void> {
    const challenges = await this.getChallenges();
    const filtered = challenges.filter(c => c.id !== id);
    await this.challengeStorage.save(filtered);
  }

  private recalculateChallengeStats(challenge: Challenge): void {
    const completedDays = challenge.days.filter(d => d.status === ChallengeDayStatus.COMPLETED);
    const failedDays = challenge.days.filter(d => d.status === ChallengeDayStatus.FAILED);

    challenge.completedDays = completedDays.length;
    challenge.failedDays = failedDays.length;

    // Sort days by date for streak calculation
    const sortedDays = [...challenge.days].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate longest streak
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

    // Calculate current streak from the end
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

export const focusStorage = new FocusStorageService();