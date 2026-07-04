import { SessionPlan } from '@/features/timer/types';

export type SessionType = 'FOCUS' | 'BREAK' | 'LONG_BREAK';
export type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

export interface ActiveSessionSnapshot {
  id: string; // unique ID for the session
  type: SessionType;
  startTime: number; // timestamp when session started
  targetDuration: number; // duration in seconds
  elapsedAtLastSnapshot: number; // accumulated elapsed time
  lastUpdated: number; // timestamp of last snapshot (Date.now())
  status: TimerStatus;

  // For resume calculation:
  // if 'running', trueElapsed = elapsedAtLastSnapshot + (now - lastUpdated)
  // if 'paused', trueElapsed = elapsedAtLastSnapshot
}

// Full plan snapshot for comprehensive crash recovery
export interface ActivePlanSnapshot {
  plan: SessionPlan;
  lastUpdated: number;
}

export const SNAPSHOT_KEY = 'FOCUS_SESSION_SNAPSHOT';
export const PLAN_SNAPSHOT_KEY = 'FOCUS_SESSION_PLAN_SNAPSHOT';
