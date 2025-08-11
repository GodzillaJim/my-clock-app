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
  formatDuration 
} from '@/features/timer/types';

class FocusStorageService {
  private readonly STORAGE_KEY = 'focus_sessions_app_state';
  private readonly DB_NAME = 'FocusSessionsDB';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('type', 'type', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('dailyHistory')) {
          db.createObjectStore('dailyHistory', { keyPath: 'date' });
        }
        
        if (!db.objectStoreNames.contains('appState')) {
          db.createObjectStore('appState', { keyPath: 'key' });
        }
      };
    });
  }

  async getAppState(): Promise<AppState> {
    const defaultState: AppState = {
      version: '1.0.0',
      currentSession: null,
      dailyHistory: null,
      settings: DEFAULT_SETTINGS,
      lastActiveDate: getTodayDateString()
    };

    if (!this.db) {
      await this.initialize();
    }

    try {
      const transaction = this.db!.transaction(['appState'], 'readonly');
      const store = transaction.objectStore('appState');
      const request = store.get('current');
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data) {
            const state = { ...defaultState, ...result.data };
            
            if (state.lastActiveDate !== getTodayDateString()) {
              state.currentSession = null;
              state.lastActiveDate = getTodayDateString();
            }
            
            resolve(state);
          } else {
            resolve(defaultState);
          }
        };
        
        request.onerror = () => resolve(defaultState);
      });
    } catch (error) {
      console.error('Failed to get app state:', error);
      return defaultState;
    }
  }

  async saveAppState(state: AppState): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(['appState'], 'readwrite');
    const store = transaction.objectStore('appState');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key: 'current', data: state, updatedAt: new Date() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTodayHistory(): Promise<DailyHistory> {
    const today = getTodayDateString();
    
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(['dailyHistory'], 'readonly');
    const store = transaction.objectStore('dailyHistory');
    const request = store.get(today);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          const newHistory: DailyHistory = {
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
          resolve(newHistory);
        }
      };
      
      request.onerror = () => {
        const newHistory: DailyHistory = {
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
        resolve(newHistory);
      };
    });
  }

  async saveTodayHistory(history: DailyHistory): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const updatedHistory = {
      ...history,
      updatedAt: new Date()
    };

    const transaction = this.db!.transaction(['dailyHistory'], 'readwrite');
    const store = transaction.objectStore('dailyHistory');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(updatedHistory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addSession(session: SessionRecord): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const sessionWithDate = {
      ...session,
      date: getTodayDateString()
    };

    const transaction = this.db!.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(sessionWithDate);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await this.updateDailyHistoryWithSession(session);
  }

  private async updateDailyHistoryWithSession(session: SessionRecord): Promise<void> {
    const history = await this.getTodayHistory();
    
    const existingSessionIndex = history.sessions.findIndex(s => s.id === session.id);
    if (existingSessionIndex >= 0) {
      history.sessions[existingSessionIndex] = session;
    } else {
      history.sessions.push(session);
    }

    this.recalculateHistoryStats(history);
    await this.saveTodayHistory(history);
  }

  private recalculateHistoryStats(history: DailyHistory): void {
    const focusSessions = history.sessions.filter(s => s.type === SessionType.FOCUS);
    const breakSessions = history.sessions.filter(s => s.type !== SessionType.FOCUS);
    
    history.totalFocusTime = focusSessions.reduce((total, session) => 
      total + session.actualDuration, 0);
    
    history.totalBreakTime = breakSessions.reduce((total, session) => 
      total + session.actualDuration, 0);

    history.completedSessions = history.sessions.filter(s => 
      s.completionStatus === CompletionStatus.COMPLETED).length;
    
    history.interruptedSessions = history.sessions.filter(s => 
      s.completionStatus === CompletionStatus.INTERRUPTED).length;
    
    history.skippedSessions = history.sessions.filter(s => 
      s.completionStatus === CompletionStatus.SKIPPED).length;

    const completedFocusSessions = focusSessions.filter(s => 
      s.completionStatus === CompletionStatus.COMPLETED);
    
    if (completedFocusSessions.length > 0) {
      history.averageSessionLength = Math.round(
        completedFocusSessions.reduce((total, session) => 
          total + session.actualDuration, 0) / completedFocusSessions.length
      );
    } else {
      history.averageSessionLength = 0;
    }

    history.longestStreak = this.calculateLongestStreak(history.sessions);
  }

  private calculateLongestStreak(sessions: SessionRecord[]): number {
    let maxStreak = 0;
    let currentStreak = 0;
    
    const focusSessions = sessions
      .filter(s => s.type === SessionType.FOCUS)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    for (const session of focusSessions) {
      if (session.completionStatus === CompletionStatus.COMPLETED) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    return maxStreak;
  }

  async getSessionStats(): Promise<SessionStats> {
    const history = await this.getTodayHistory();
    const focusSessions = history.sessions.filter(s => s.type === SessionType.FOCUS);
    
    let currentStreak = 0;
    const reversedFocusSessions = [...focusSessions].reverse();
    
    for (const session of reversedFocusSessions) {
      if (session.completionStatus === CompletionStatus.COMPLETED) {
        currentStreak++;
      } else {
        break;
      }
    }

    const totalMinutes = Math.round(history.totalFocusTime);
    const targetMinutes = focusSessions.length * 25; // Assuming 25min default
    const progress = targetMinutes > 0 ? Math.round((totalMinutes / targetMinutes) * 100) : 0;

    return {
      totalFocusTime: formatDuration(totalMinutes),
      completedSessions: history.completedSessions,
      currentStreak,
      todayProgress: Math.min(progress, 100),
      averageSessionTime: formatDuration(history.averageSessionLength)
    };
  }

  async clearTodayHistory(): Promise<void> {
    const today = getTodayDateString();
    
    if (!this.db) {
      await this.initialize();
    }

    const newHistory: DailyHistory = {
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

    await this.saveTodayHistory(newHistory);
    
    const transaction = this.db!.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    const index = store.index('date');
    const request = index.openCursor(IDBKeyRange.only(today));
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  async shouldResetDaily(): Promise<boolean> {
    const state = await this.getAppState();
    const today = getTodayDateString();
    
    return state.settings.autoResetDaily && state.lastActiveDate !== today;
  }

  async exportHistory(startDate: string, endDate: string, format: 'csv' | 'json'): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

    const sessions: SessionRecord[] = [];
    const transaction = this.db!.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('date');
    
    return new Promise((resolve) => {
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.openCursor(range);
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          sessions.push(cursor.value);
          cursor.continue();
        } else {
          if (format === 'csv') {
            resolve(this.generateCSV(sessions));
          } else {
            resolve(JSON.stringify(sessions, null, 2));
          }
        }
      };
    });
  }

  private generateCSV(sessions: SessionRecord[]): string {
    const headers = ['Date', 'Session #', 'Type', 'Planned Duration (min)', 'Actual Duration (min)', 'Start Time', 'End Time', 'Status'];
    const rows = sessions.map(session => [
      getTodayDateString(),
      session.sessionNumber.toString(),
      session.type,
      session.plannedDuration.toString(),
      session.actualDuration.toString(),
      session.startTime.toLocaleString(),
      session.endTime ? session.endTime.toLocaleString() : 'N/A',
      session.completionStatus
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  async scheduleAutomaticReset(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const millisecondsUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(async () => {
      if (await this.shouldResetDaily()) {
        await this.clearTodayHistory();
        const state = await this.getAppState();
        state.lastActiveDate = getTodayDateString();
        state.currentSession = null;
        await this.saveAppState(state);
      }
      
      this.scheduleAutomaticReset();
    }, millisecondsUntilMidnight);
  }
}

export const focusStorage = new FocusStorageService();