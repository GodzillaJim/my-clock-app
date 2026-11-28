import { describe, expect, it } from 'vitest';
import { ipcArgSchemas } from '../electron/main/ipcSchemas';
import { parseIpcArgs } from '../electron/main/ipcValidation';

const session = {
  id: 's1',
  type: 'focus',
  sessionNumber: 1,
  plannedDuration: 1500,
  actualDuration: 1500,
  startTime: new Date('2026-11-28T09:00:00Z'),
  endTime: new Date('2026-11-28T09:25:00Z'),
  pausedTime: 0,
  completionStatus: 'completed',
  remainingTime: 0,
};

const plan = {
  id: 'p1',
  createdAt: 1,
  status: 'active',
  segments: [
    {
      id: 'seg1',
      index: 0,
      type: 'focus',
      plannedDuration: 1500,
      actualDuration: null,
      expectedStartTime: 1,
      expectedEndTime: 2,
      actualStartTime: null,
      actualEndTime: null,
      status: 'pending',
      pausedTime: 0,
      elapsedAtLastUpdate: 0,
    },
  ],
  currentSegmentIndex: -1,
  settings: { focusDuration: 25, shortBreakDuration: 5 },
  expectedEndTime: 2,
  actualEndTime: null,
  interruptedAt: null,
  totalPlannedDuration: 1500,
  totalElapsed: 0,
  lastUpdated: 1,
};

const valid = (channel: keyof typeof ipcArgSchemas, args: unknown[]) =>
  ipcArgSchemas[channel].safeParse(args).success;

describe('IPC argument schemas', () => {
  it('accept well-formed calls', () => {
    expect(valid('db:sessions:save', [session])).toBe(true);
    expect(valid('db:plans:save', [plan])).toBe(true);
    expect(valid('db:sessions:getHistory', [])).toBe(true);
    expect(valid('db:sessions:getHistory', [50])).toBe(true);
    expect(valid('db:feedback:getAll', [{ status: 'open', limit: 10 }])).toBe(true);
    expect(valid('db:kv:set', ['app_state', { version: '1.0.0' }])).toBe(true);
    expect(valid('show-window', [])).toBe(true);
  });

  it('coerces dates that arrive as strings', () => {
    const parsed = ipcArgSchemas['db:sessions:save'].parse([
      { ...session, startTime: '2026-11-28T09:00:00.000Z' },
    ]);
    expect(parsed[0].startTime).toBeInstanceOf(Date);
  });

  it('reject wrong types, unknown enum values and malformed dates', () => {
    expect(valid('db:sessions:save', [{ ...session, type: 'FOCUS' }])).toBe(false);
    expect(valid('db:sessions:save', [{ ...session, plannedDuration: '1500' }])).toBe(false);
    expect(valid('db:sessions:save', [{ ...session, id: '' }])).toBe(false);
    expect(valid('db:sessions:getByDate', ['28/11/2026'])).toBe(false);
    expect(valid('db:feedback:getAll', [{ severity: 'urgent' }])).toBe(false);
    expect(valid('db:sessions:getHistory', [-1])).toBe(false);
  });

  it('reject missing and extra arguments', () => {
    expect(valid('db:sessions:delete', [])).toBe(false);
    expect(valid('db:sessions:delete', ['a', 'b'])).toBe(false);
    expect(valid('show-window', ['unexpected'])).toBe(false);
  });

  it('only stores known key-value documents, as JSON objects', () => {
    expect(valid('db:kv:get', ['secrets'])).toBe(false);
    expect(valid('db:kv:set', ['secrets', {}])).toBe(false);
    expect(valid('db:kv:set', ['app_state', 'not an object'])).toBe(false);
    expect(valid('db:kv:set', ['lifetime_stats', [1, 2]])).toBe(false);
  });

  it('strips unknown fields, so they never reach the repositories', () => {
    const [, updates] = ipcArgSchemas['db:plans:update'].parse([
      'p1',
      { status: 'completed', 'status = 1; DROP TABLE sessions; --': 'x' },
    ]);
    expect(updates).toEqual({ status: 'completed' });
  });

  it('bounds collection sizes', () => {
    const segments = Array.from({ length: 501 }, (_, i) => ({ ...plan.segments[0], index: i }));
    expect(valid('db:plans:save', [{ ...plan, segments }])).toBe(false);
  });
});

describe('parseIpcArgs', () => {
  it('returns parsed arguments on success', () => {
    expect(parseIpcArgs('db:sessions:delete', ipcArgSchemas['db:sessions:delete'], ['x'])).toEqual({
      ok: true,
      args: ['x'],
    });
  });

  it('names the channel and the offending field on failure', () => {
    const result = parseIpcArgs('db:sessions:save', ipcArgSchemas['db:sessions:save'], [
      { ...session, type: 'nap' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid arguments for db:sessions:save');
      expect(result.error).toContain('0.type');
    }
  });
});
