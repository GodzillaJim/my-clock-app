// Core Domain Types for Focus Sessions App
export enum SessionType {
  FOCUS = 'focus',
  SHORT_BREAK = 'shortBreak',
  LONG_BREAK = 'longBreak',
}

export enum TimerState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export enum CompletionStatus {
  COMPLETED = 'completed',
  INTERRUPTED = 'interrupted',
  SKIPPED = 'skipped',
}

// Session with enhanced tracking capabilities
export interface SessionRecord {
  readonly id: string;
  type: SessionType;
  sessionNumber: number; // Daily session counter
  plannedDuration: number; // in seconds
  actualDuration: number; // in seconds
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
  totalFocusTime: number; // in seconds
  totalBreakTime: number; // in seconds
  completedSessions: number;
  interruptedSessions: number;
  skippedSessions: number;
  averageSessionLength: number; // in seconds
  longestStreak: number; // consecutive completed sessions
  createdAt: Date;
  updatedAt: Date;
  // Enhanced record-keeping fields
  dayStartTime: number | null; // timestamp of first session start
  dayEndTime: number | null; // timestamp of last session end
  sessionPlanIds: string[]; // IDs of SessionPlans that ran this day
  totalPlannedTime: number; // seconds, total planned across all plans
  totalActualTime: number; // seconds, total actual across all plans
  completionRate: number; // 0-1, completed segments / total segments
}

// Application settings
export interface AppSettings {
  // Timer Configuration
  focusDuration: number; // minutes (1-240)
  shortBreakDuration: number; // minutes
  resumeStrategy: 'elapsed' | 'pause'; // How to handle time when app was closed
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
  uiTheme: 'deepFocus' | 'aerogel'; // Visual style theme
  layout: 'zen' | 'dashboard' | 'commandCenter'; // UI layout style
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

// Notification types
export interface SessionNotification {
  type: 'session_start' | 'session_complete' | 'break_complete' | 'break_reminder';
  title: string;
  body: string;
  sound?: string;
  timestamp: Date;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  resumeStrategy: 'elapsed',
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
  uiTheme: 'deepFocus',
  layout: 'zen',
};

// Format seconds directly (used by updated session records now in seconds)
export const formatDurationFromSeconds = (seconds: number): string => {
  if (seconds < 60) return '< 1m';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

export const formatTime = (date: Date, format: '12h' | '24h'): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: format === '12h',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// ============================================
// Challenge Types
// ============================================

export enum ChallengeStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
}

export enum ChallengeDayStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface ChallengeDay {
  date: string; // YYYY-MM-DD format
  status: ChallengeDayStatus;
  note?: string;
  markedAt?: Date;
}

export interface Challenge {
  readonly id: string;
  name: string;
  description?: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  durationDays: number;
  status: ChallengeStatus;
  days: ChallengeDay[];
  createdAt: Date;
  updatedAt: Date;
  completedDays: number;
  failedDays: number;
  currentStreak: number;
  longestStreak: number;
}

export type ChallengeDurationPreset = 7 | 30 | 90 | 'custom';

// Utility function to create default challenge days
export const createChallengeDays = (startDate: string, endDate: string): ChallengeDay[] => {
  const days: ChallengeDay[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    days.push({
      date: current.toISOString().split('T')[0],
      status: ChallengeDayStatus.PENDING,
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
};

// ============================================
// Session Plan Types (Comprehensive Record Keeping)
// ============================================

export type SessionPlanStatus = 'active' | 'completed' | 'interrupted' | 'abandoned';
export type SegmentStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'interrupted';

export interface SessionPlanSegment {
  id: string;
  index: number;
  type: SessionType;
  plannedDuration: number; // seconds
  actualDuration: number | null; // seconds, filled on completion
  expectedStartTime: number; // timestamp
  expectedEndTime: number; // timestamp
  actualStartTime: number | null;
  actualEndTime: number | null;
  status: SegmentStatus;
  pausedTime: number; // total ms spent paused
  elapsedAtLastUpdate: number; // seconds elapsed (for crash recovery)
}

export interface SessionPlan {
  id: string;
  createdAt: number; // timestamp
  status: SessionPlanStatus;
  segments: SessionPlanSegment[];
  currentSegmentIndex: number; // -1 if not started
  settings: {
    focusDuration: number; // minutes
    shortBreakDuration: number; // minutes
  };
  expectedEndTime: number; // timestamp
  actualEndTime: number | null;
  interruptedAt: number | null;
  totalPlannedDuration: number; // seconds
  totalElapsed: number; // seconds
  lastUpdated: number; // timestamp
}

export interface PeriodSummary {
  totalFocusTime: number; // seconds
  totalSessions: number;
  averageDailyFocusTime: number; // seconds
  completionRate: number; // 0-1
  daysActive: number;
}

export interface LifetimeStats {
  lastUpdated: number;
  totalDaysActive: number;
  totalSessions: number;
  totalFocusTime: number; // seconds
  totalBreakTime: number; // seconds

  averageDayStartTime: string; // "HH:mm"
  averageDayEndTime: string; // "HH:mm"
  averageDailyFocusTime: number; // seconds
  averageDailySessionCount: number;
  averageSessionDuration: number; // seconds

  currentDayStreak: number;
  longestDayStreak: number;

  overallCompletionRate: number; // 0-1
  totalInterruptedSessions: number;

  last7Days: PeriodSummary;
  last30Days: PeriodSummary;
}
