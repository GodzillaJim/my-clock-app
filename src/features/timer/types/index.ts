// Core Domain Types for Focus Sessions App
export enum SessionType {
  FOCUS = 'focus',
  SHORT_BREAK = 'shortBreak',
  LONG_BREAK = 'longBreak'
}

export enum TimerState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

export enum CompletionStatus {
  COMPLETED = 'completed',
  INTERRUPTED = 'interrupted',
  SKIPPED = 'skipped'
}

// Session with enhanced tracking capabilities
export interface SessionRecord {
  readonly id: string;
  type: SessionType;
  sessionNumber: number; // Daily session counter
  plannedDuration: number; // in minutes
  actualDuration: number; // in minutes
  startTime: Date;
  endTime: Date | null;
  pausedTime: number; // total paused time in ms
  completionStatus: CompletionStatus;
  remainingTime: number; // in seconds for active sessions
}

// Daily session history and statistics
export interface DailyHistory {
  date: string; // YYYY-MM-DD format
  sessions: SessionRecord[];
  totalFocusTime: number; // in minutes
  totalBreakTime: number; // in minutes
  completedSessions: number;
  interruptedSessions: number;
  skippedSessions: number;
  averageSessionLength: number; // in minutes
  longestStreak: number; // consecutive completed sessions
  createdAt: Date;
  updatedAt: Date;
}

// Application settings
export interface AppSettings {
  // Timer Configuration
  focusDuration: number; // minutes (1-240)
  shortBreakDuration: number; // minutes
  longBreakDuration: number; // minutes
  sessionsBeforeLongBreak: number;
  quickPresets: number[]; // Quick duration presets in minutes
  
  // Display Settings
  timeFormat: '12h' | '24h';
  showSessionStartTime: boolean;
  showSessionEndTime: boolean;
  
  // Notification Settings
  enableAudioNotifications: boolean;
  enableVisualNotifications: boolean;
  enableSystemNotifications: boolean;
  notificationVolume: number; // 0-100
  sessionCompleteSound: string;
  breakCompleteSound: string;
  enableTickSound: boolean;
  
  // Behavior Settings
  autoStartBreaks: boolean;
  autoStartNextSession: boolean;
  minimizeToSystemTray: boolean;
  
  // UI Settings
  theme: 'light' | 'dark' | 'system';
  
  // Data Settings
  autoResetDaily: boolean;
  exportFormat: 'csv' | 'json';
}

// Current timer state for persistence
export interface TimerSession {
  id: string;
  type: SessionType;
  sessionNumber: number;
  plannedDuration: number; // in minutes
  remainingTime: number; // in seconds
  startTime: Date;
  pausedAt: Date | null;
  totalPausedTime: number; // in milliseconds
  state: TimerState;
}

// Application state for persistence
export interface AppState {
  version: string;
  currentSession: TimerSession | null;
  dailyHistory: DailyHistory | null;
  settings: AppSettings;
  lastActiveDate: string; // YYYY-MM-DD
}

// Statistics for UI display
export interface SessionStats {
  totalFocusTime: string; // formatted time
  completedSessions: number;
  currentStreak: number;
  todayProgress: number; // percentage
  averageSessionTime: string; // formatted time
}

// Notification types
export interface SessionNotification {
  type: 'session_complete' | 'break_complete' | 'break_reminder';
  title: string;
  body: string;
  sound?: string;
  timestamp: Date;
}

// Time display information
export interface TimeDisplay {
  current: string; // Current time
  sessionStart: string; // When session started
  expectedEnd: string; // When session should end
  actualEnd?: string; // When session actually ended
  remainingTime: string; // Time left in session
  progress: number; // 0-100 percentage
}

// Export history data
export interface HistoryExport {
  exportDate: Date;
  dateRange: {
    start: string;
    end: string;
  };
  sessions: SessionRecord[];
  summary: {
    totalSessions: number;
    totalFocusTime: number;
    totalBreakTime: number;
    averageSessionLength: number;
    completionRate: number;
  };
}

// Service errors
export interface ServiceError {
  origin: 'storage' | 'timer' | 'notification' | 'export';
  error: Error;
  context?: Record<string, unknown>;
  timestamp: Date;
}

// Keyboard shortcut definitions
export interface KeyboardShortcut {
  key: string;
  action: 'start' | 'pause' | 'stop' | 'skip' | 'settings' | 'history';
  description: string;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  quickPresets: [15, 25, 30, 45, 60],
  timeFormat: '12h',
  showSessionStartTime: true,
  showSessionEndTime: true,
  enableAudioNotifications: true,
  enableVisualNotifications: true,
  enableSystemNotifications: true,
  notificationVolume: 80,
  sessionCompleteSound: 'default',
  breakCompleteSound: 'default',
  enableTickSound: false,
  autoStartBreaks: false,
  autoStartNextSession: false,
  minimizeToSystemTray: true,
  theme: 'system',
  autoResetDaily: true,
  exportFormat: 'csv'
};

// Type Guards
export const isFocusSession = (session: SessionRecord): boolean => 
  session.type === SessionType.FOCUS;

export const isBreakSession = (session: SessionRecord): boolean =>
  session.type === SessionType.SHORT_BREAK || session.type === SessionType.LONG_BREAK;

export const isActiveSession = (state: TimerState): boolean =>
  state === TimerState.RUNNING || state === TimerState.PAUSED;

// Backward compatibility types for legacy components
export interface SessionItem extends SessionRecord {
  minutes: number; // Same as plannedDuration
  remainingMinutes: number; // Calculated from remainingTime
  completedAt?: Date; // Same as endTime
}

// Utility functions for backward compatibility
export const toSessionItem = (record: SessionRecord): SessionItem => ({
  ...record,
  minutes: record.plannedDuration,
  remainingMinutes: Math.ceil(record.remainingTime / 60),
  completedAt: record.endTime || undefined
});

export const fromSessionItem = (item: SessionItem): SessionRecord => ({
  id: item.id,
  type: item.type,
  sessionNumber: item.sessionNumber,
  plannedDuration: item.minutes,
  actualDuration: item.actualDuration,
  startTime: item.startTime,
  endTime: item.completedAt || item.endTime,
  pausedTime: item.pausedTime,
  completionStatus: item.completionStatus,
  remainingTime: item.remainingMinutes * 60
});

export const isCompletedSession = (session: SessionRecord): boolean =>
  session.completionStatus === CompletionStatus.COMPLETED;

// Utility Functions
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const formatTime = (date: Date, format: '12h' | '24h'): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: format === '12h',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Export types for external use and backward compatibility
export type {
  SessionRecord as Session,
  DailyHistory as History,
  AppSettings as Settings,
  TimerSession as CurrentSession,
  SessionStats as Stats
};

// Backward compatibility exports
export interface TaskType {
  id: string;
  title: string;
  description?: string;
  durationInMinutes: number;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  sessions: SessionRecord[];
}