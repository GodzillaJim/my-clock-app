// Core Domain Types
export enum SessionType {
    FOCUS = 'focus',
    SHORT_BREAK = 'shortBreak',
    LONG_BREAK = 'longBreak',
    COMPLETION = 'completion'
  }
  
  export interface TaskType {
    id: string;
    title: string;
    description?: string;
    durationInMinutes: number;
    completed: boolean;
    createdAt: Date;
    completedAt?: Date;
    sessions: SessionItem[];
  }
  
  export interface SessionItem {
    readonly id: string;
    type: SessionType;
    minutes: number;
    sessionNumber?: number;
    remainingMinutes: number;
    createdAt: Date;
    completedAt?: Date;
    skipped?: boolean;
  }
  
  // State Machine Types
  export enum TimerState {
    IDLE = 'idle',
    RUNNING = 'running',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    SKIPPED = 'skipped',
    ERROR = 'error'
  }
  
  // Configuration Types
  export interface SessionConfig {
    focusDuration: number;
    shortBreak: number;
    longBreak: number;
    sessionsBeforeLongBreak: number;
  }
  
  export interface TimerConfig {
    enableNotifications: boolean;
    persistState: boolean;
    autoStartNextSession: boolean;
  }
  
  // Storage Types
  export interface SessionStorage {
    version: string;
    tasks: TaskType[];
    sessions: SessionItem[];
    currentTaskIndex: number;
    currentSessionIndex: number;
    timerState: TimerState;
    config: TimerConfig;
  }
  
  // API Response Types (for future expansion)
  export interface APIError {
    code: string;
    message: string;
    timestamp: Date;
  }
  
  export interface ServiceError {
    origin: 'storage' | 'timer' | 'notification';
    error: Error;
    context?: Record<string, unknown>;
  }
  
  // Utility Types
  export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
  export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
  } : T;
  
  // Type Guards
  export const isFocusSession = (session: SessionItem): session is SessionItem => 
    session.type === SessionType.FOCUS;
  
  export const isBreakSession = (session: SessionItem): session is SessionItem =>
    session.type === SessionType.SHORT_BREAK || session.type === SessionType.LONG_BREAK;
  
  export const isCompletedSession = (session: SessionItem): boolean =>
    session.remainingMinutes <= 0 && !session.skipped;
  
  // Export all types
  export type {
    TaskType as Task,
    SessionItem as Session,
    SessionConfig as SessionSettings,
    TimerConfig as TimerSettings
  };