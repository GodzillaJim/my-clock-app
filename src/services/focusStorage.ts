import { 
  AppState, 
  DailyHistory, 
  SessionRecord, 
  TimerSession, 
  AppSettings, 
  DEFAULT_SETTINGS,
  SessionType,
  CompletionStatus,
  getTodayDateString,
  SessionStats,
  formatDurationFromSeconds 
} from '@/features/timer/types';
import { FeedbackItem } from '@/types/feedback';
import { createStorageService } from './storage';

class FocusStorageService {
  private appStateStorage = createStorageService<AppState>('focus_sessions_app_state');
  private sessionsStorage = createStorageService<SessionRecord[]>('focus_sessions_sessions');
  private dailyHistoryStorage = createStorageService<DailyHistory[]>('focus_sessions_daily_history');
  private feedbackStorage = createStorageService<FeedbackItem[]>('focus_sessions_feedback');

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
    const completedSessions = sessions.filter(s => s.completionStatus === 'completed');
    const totalFocusSeconds = sessions.filter(s => s.type === 'focus').reduce((sum, s) => sum + s.actualDuration, 0);
    const totalBreakSeconds = sessions.filter(s => s.type !== 'focus').reduce((sum, s) => sum + s.actualDuration, 0);

    // Current streak of completed focus sessions at end
    let currentStreak = 0;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      if (s.completionStatus === 'completed' && s.type === 'focus') currentStreak++; else break;
    }

    // Longest streak of completed focus sessions
    let longestStreak = 0; let tmp = 0;
    for (const s of sessions) {
      if (s.completionStatus === 'completed' && s.type === 'focus') { tmp++; longestStreak = Math.max(longestStreak, tmp);} else tmp = 0;
    }

    const avgSeconds = totalSessions > 0 ? (totalFocusSeconds + totalBreakSeconds) / totalSessions : 0;
    const completionRate = totalSessions > 0 ? completedSessions.length / totalSessions : 0;
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

      const completedSessions = daySessions.filter(s => s.completionStatus === 'completed');
      const totalFocusSeconds = daySessions.filter(s => s.type === 'focus').reduce((sum, s) => sum + s.actualDuration, 0);
      const totalBreakSeconds = daySessions.filter(s => s.type !== 'focus').reduce((sum, s) => sum + s.actualDuration, 0);

      const history: DailyHistory = {
        date,
        sessions: daySessions,
        totalFocusTime: totalFocusSeconds,
        totalBreakTime: totalBreakSeconds,
        completedSessions: completedSessions.length,
        interruptedSessions: daySessions.filter(s => s.completionStatus === 'interrupted').length,
        skippedSessions: daySessions.filter(s => s.completionStatus === 'skipped').length,
        averageSessionLength: daySessions.length > 0 ? totalFocusSeconds / daySessions.length : 0,
        longestStreak: 0,
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
      let filtered = [...feedbacks];

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
      inProgress: feedbacks.filter(f => f.status === 'in-progress').length
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
        f.timestamp.toISOString(), f.status
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
}

export const focusStorage = new FocusStorageService();