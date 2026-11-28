/**
 * Runtime validation for every invoke channel in the IPC contract. Each schema
 * is checked against the contract's argument tuple, so the two cannot drift.
 * Unknown object keys are stripped; dates arriving as strings are coerced.
 */
import { z } from 'zod';
import {
  ChallengeDayStatus,
  ChallengeStatus,
  CompletionStatus,
  SessionType,
  type AppState,
  type LifetimeStats,
} from '../../src/features/timer/types';
import type { InvokeArgs, InvokeChannel } from '../ipc/contract';

const MAX_TEXT = 10_000;

const id = z.string().min(1).max(200);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');
const text = z.string().max(MAX_TEXT);
const count = z.number().int().nonnegative();
const amount = z.number().finite();
const timestamp = z.number().finite();
const date = z.coerce.date();

const sessionRecord = z.object({
  id,
  type: z.enum(SessionType),
  sessionNumber: count,
  plannedDuration: amount,
  actualDuration: amount,
  startTime: date,
  endTime: date.nullable(),
  pausedTime: amount,
  completionStatus: z.enum(CompletionStatus),
  remainingTime: amount,
});

const segment = z.object({
  id,
  index: count,
  type: z.enum(SessionType),
  plannedDuration: amount,
  actualDuration: amount.nullable(),
  expectedStartTime: timestamp,
  expectedEndTime: timestamp,
  actualStartTime: timestamp.nullable(),
  actualEndTime: timestamp.nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'interrupted']),
  pausedTime: amount,
  elapsedAtLastUpdate: amount,
});

const planFields = {
  createdAt: timestamp,
  status: z.enum(['active', 'completed', 'interrupted', 'abandoned']),
  segments: z.array(segment).max(500),
  currentSegmentIndex: z.number().int().min(-1),
  settings: z.object({ focusDuration: amount, shortBreakDuration: amount }),
  expectedEndTime: timestamp,
  actualEndTime: timestamp.nullable(),
  interruptedAt: timestamp.nullable(),
  totalPlannedDuration: amount,
  totalElapsed: amount,
  lastUpdated: timestamp,
};
const sessionPlan = z.object({ id, ...planFields });
const planUpdate = z.object(planFields).partial();

const dailyHistory = z.object({
  date: isoDate,
  sessions: z.array(sessionRecord),
  totalFocusTime: amount,
  totalBreakTime: amount,
  completedSessions: count,
  interruptedSessions: count,
  skippedSessions: count,
  averageSessionLength: amount,
  longestStreak: count,
  createdAt: date,
  updatedAt: date,
  dayStartTime: timestamp.nullable(),
  dayEndTime: timestamp.nullable(),
  sessionPlanIds: z.array(id),
  totalPlannedTime: amount,
  totalActualTime: amount,
  completionRate: amount,
});

const challenge = z.object({
  id,
  name: z.string().min(1).max(500),
  description: text.optional(),
  startDate: isoDate,
  endDate: isoDate,
  durationDays: z.number().int().positive(),
  status: z.enum(ChallengeStatus),
  days: z
    .array(
      z.object({
        date: isoDate,
        status: z.enum(ChallengeDayStatus),
        note: text.optional(),
        markedAt: date.optional(),
      }),
    )
    .max(3660),
  createdAt: date,
  updatedAt: date,
  completedDays: count,
  failedDays: count,
  currentStreak: count,
  longestStreak: count,
});

const feedbackType = z.enum(['bug', 'feature-request', 'issue', 'general']);
const feedbackStatus = z.enum(['open', 'in-progress', 'resolved', 'dismissed']);
const feedbackSeverity = z.enum(['low', 'medium', 'high', 'critical']);

const feedbackItem = z.object({
  id,
  type: feedbackType,
  title: z.string().min(1).max(500),
  description: text,
  severity: feedbackSeverity,
  category: z.string().max(200),
  timestamp: date,
  status: feedbackStatus,
  userAgent: z.string().max(1000).optional(),
  appVersion: z.string().max(100).optional(),
  sessionContext: z
    .object({
      timerState: z.string().max(100).optional(),
      sessionType: z.string().max(100).optional(),
      currentSession: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Key-value documents are stored as opaque JSON and never reach SQL, so only
 * their outer shape is checked; the renderer owns (and migrates) their fields.
 */
const jsonDocument = <T>() =>
  z.custom<T>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    'Expected a JSON object',
  );

const none = z.tuple([]);
const one = <T extends z.ZodType>(schema: T) => z.tuple([schema]);

type ArgSchemas = { [C in InvokeChannel]: z.ZodType<InvokeArgs<C>> };

export const ipcArgSchemas: ArgSchemas = {
  'minimize-to-tray': none,
  'show-window': none,
  'update-tray-status': one(z.string().max(200)),
  'session-notification': one(z.object({ title: z.string().max(200), body: z.string().max(1000) })),

  'db:sessions:save': one(sessionRecord),
  'db:sessions:getByDate': one(isoDate),
  'db:sessions:getHistory': z.tuple([z.number().int().positive().optional()]),
  'db:sessions:delete': one(id),

  'db:plans:save': one(sessionPlan),
  'db:plans:get': one(id),
  'db:plans:getByDate': one(isoDate),
  'db:plans:getByDateRange': z.tuple([isoDate, isoDate]),
  'db:plans:update': z.tuple([id, planUpdate]),

  'db:history:save': one(dailyHistory),
  'db:history:getByDate': one(isoDate),
  'db:history:getByRange': z.tuple([isoDate, isoDate]),
  'db:history:getAllDates': none,
  'db:history:clearToday': one(isoDate),
  'db:history:resetAll': none,

  'db:challenges:getAll': none,
  'db:challenges:getById': one(id),
  'db:challenges:save': one(challenge),
  'db:challenges:delete': one(id),

  'db:feedback:getAll': z.tuple([
    z
      .object({
        type: feedbackType.optional(),
        status: feedbackStatus.optional(),
        severity: feedbackSeverity.optional(),
        limit: z.number().int().positive().max(10_000).optional(),
      })
      .optional(),
  ]),
  'db:feedback:save': one(feedbackItem),
  'db:feedback:update': z.tuple([id, z.object({ status: feedbackStatus.optional() })]),
  'db:feedback:delete': one(id),
  'db:feedback:getStats': none,

  'db:kv:get': one(z.enum(['app_state', 'lifetime_stats'])),
  'db:kv:set': z.union([
    z.tuple([z.literal('app_state'), jsonDocument<AppState>()]),
    z.tuple([z.literal('lifetime_stats'), jsonDocument<LifetimeStats>()]),
  ]),

  'db:snapshot:save': one(sessionPlan),
  'db:snapshot:load': none,
  'db:snapshot:clear': none,
};
