import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown, useStopwatch } from '../useToolTimers';
import { runFocusEffect } from '../useFocusTimer';
import type { SessionPlan, SessionRecord } from '@/features/timer/types';

const mocks = vi.hoisted(() => ({
  focusStorage: {
    addSession: vi.fn(() => Promise.resolve()),
    saveSessionPlan: vi.fn(() => Promise.resolve()),
    recalculateLifetimeStats: vi.fn(() => Promise.resolve()),
  },
  persistenceService: {
    savePlanSnapshot: vi.fn(),
    clearPlanSnapshot: vi.fn(),
  },
  notificationService: {
    showNotification: vi.fn(),
    playTickSound: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/services/focusStorage', () => ({ focusStorage: mocks.focusStorage }));
vi.mock('@/services/persistenceService', () => ({ persistenceService: mocks.persistenceService }));
vi.mock('@/services/notificationService', () => ({
  notificationService: mocks.notificationService,
}));

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T09:00:00'));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useCountdown', () => {
  it('counts down, pauses, and notifies when it reaches zero', async () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current.isActive).toBe(false);

    act(() => result.current.actions.start(3));
    expect(result.current.isRunning).toBe(true);
    expect(result.current.remainingSeconds).toBe(3);

    await advance(1000);
    expect(result.current.remainingSeconds).toBe(2);

    act(() => result.current.actions.pause());
    await advance(5000);
    expect(result.current.isPaused).toBe(true);
    expect(result.current.remainingSeconds).toBe(2);

    act(() => result.current.actions.resume());
    await advance(2000);

    expect(result.current.isActive).toBe(false);
    expect(mocks.notificationService.showNotification).toHaveBeenCalledTimes(1);
    expect(mocks.notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Timer Complete' }),
    );
  });

  it('resets without notifying', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.actions.start(60));
    act(() => result.current.actions.reset());
    expect(result.current.isActive).toBe(false);
    expect(mocks.notificationService.showNotification).not.toHaveBeenCalled();
  });
});

describe('useStopwatch', () => {
  it('measures elapsed time from the clock and records laps', async () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.actions.toggle());
    await advance(1500);
    act(() => result.current.actions.lap());
    await advance(500);
    act(() => result.current.actions.toggle());

    expect(result.current.isRunning).toBe(false);
    expect(result.current.elapsedMs).toBe(2000);
    expect(result.current.laps).toEqual([{ id: 1, time: 1500, lapDuration: 1500 }]);

    act(() => result.current.actions.reset());
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.laps).toEqual([]);
  });
});

describe('runFocusEffect', () => {
  const plan = { id: 'p' } as SessionPlan;
  const record = { id: 'r' } as SessionRecord;

  it('routes each effect to its service', () => {
    runFocusEffect({ type: 'savePlan', plan });
    runFocusEffect({ type: 'savePlanSnapshot', plan });
    runFocusEffect({ type: 'clearPlanSnapshot' });
    runFocusEffect({ type: 'recordSession', record });
    runFocusEffect({ type: 'recalculateStats' });
    runFocusEffect({
      type: 'notify',
      notification: { type: 'session_start', title: 'T', body: 'B' },
    });

    expect(mocks.focusStorage.saveSessionPlan).toHaveBeenCalledWith(plan);
    expect(mocks.persistenceService.savePlanSnapshot).toHaveBeenCalledWith(plan);
    expect(mocks.persistenceService.clearPlanSnapshot).toHaveBeenCalled();
    expect(mocks.focusStorage.addSession).toHaveBeenCalledWith(record);
    expect(mocks.focusStorage.recalculateLifetimeStats).toHaveBeenCalled();
    expect(mocks.notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', timestamp: expect.any(Date) }),
    );
  });

  it('logs storage failures instead of throwing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.focusStorage.saveSessionPlan.mockReturnValueOnce(Promise.reject(new Error('disk')));
    runFocusEffect({ type: 'savePlan', plan });
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    consoleError.mockRestore();
  });
});
