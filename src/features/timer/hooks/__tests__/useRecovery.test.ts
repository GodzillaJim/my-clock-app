import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionType, type SessionPlan } from '@/features/timer/types';

// Mid-day UTC, so local and UTC dates agree in any time zone the tests run in
const NOW = Date.parse('2026-03-10T12:00:00Z');
const MIN = 60_000;

/** A fresh module graph per test: its own in-memory store behind the services. */
async function load() {
  vi.resetModules();
  const [{ useRecovery }, { services }, { persistenceService }] = await Promise.all([
    import('../useRecovery'),
    import('@/services/domain'),
    import('@/services/persistenceService'),
  ]);
  return { useRecovery, services, persistenceService };
}

/** 25m focus (done) → 5m break (done) → 25m focus (10m in when it stopped) → 5m break. */
function planInProgress(status: SessionPlan['status'], id = 'plan-1'): SessionPlan {
  const start = NOW - 45 * MIN;
  const seg = (
    index: number,
    type: SessionType,
    minutes: number,
    status: SessionPlan['segments'][number]['status'],
    actualStartTime: number | null,
    elapsed = 0,
  ) => ({
    id: `${id}-s${index}`,
    index,
    type,
    plannedDuration: minutes * 60,
    actualDuration: status === 'completed' ? minutes * 60 : null,
    expectedStartTime: start,
    expectedEndTime: start,
    actualStartTime,
    actualEndTime: null,
    status,
    pausedTime: 0,
    elapsedAtLastUpdate: elapsed,
  });
  return {
    id,
    createdAt: start,
    status,
    currentSegmentIndex: 2,
    settings: { focusDuration: 25, shortBreakDuration: 5 },
    segments: [
      seg(0, SessionType.FOCUS, 25, 'completed', start),
      seg(1, SessionType.SHORT_BREAK, 5, 'completed', start + 25 * MIN),
      seg(
        2,
        SessionType.FOCUS,
        25,
        status === 'active' ? 'in_progress' : 'interrupted',
        start + 30 * MIN,
        600,
      ),
      seg(3, SessionType.SHORT_BREAK, 5, 'pending', null),
    ],
    expectedEndTime: start + 60 * MIN,
    actualEndTime: null,
    interruptedAt: status === 'interrupted' ? start + 40 * MIN : null,
    totalPlannedDuration: 3600,
    totalElapsed: 1800,
    lastUpdated: start + 40 * MIN,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(() => vi.useRealTimers());

describe('useRecovery', () => {
  it('offers nothing when no session was interrupted', async () => {
    const { useRecovery } = await load();
    const { result } = renderHook(() => useRecovery());
    await act(async () => {});
    expect(result.current.recoveryInfo).toBeNull();
  });

  it('offers the plan in the crash snapshot, with what was done and what is left', async () => {
    const { useRecovery, persistenceService } = await load();
    persistenceService.savePlanSnapshot(planInProgress('active'));

    const { result } = renderHook(() => useRecovery());
    await waitFor(() => expect(result.current.recoveryInfo).not.toBeNull());

    const info = result.current.recoveryInfo!;
    expect(info).toMatchObject({
      completedSegments: 2,
      totalSegments: 4,
      completedFocusTime: 25 * 60,
      remainingFocusTime: 15 * 60, // 25m segment, 10m of it done
      remainingSegments: 2,
      completedTimeFormatted: '25m',
      remainingTimeFormatted: '15m',
    });
    expect(info.segmentAtInterruption?.status).toBe('interrupted');
  });

  it('dismissing records the plan as interrupted and stops offering it', async () => {
    const { useRecovery, persistenceService, services } = await load();
    // The last snapshot was written 10 minutes into the third segment, then the app died
    vi.setSystemTime(NOW - 5 * MIN);
    persistenceService.savePlanSnapshot(planInProgress('active'));
    vi.setSystemTime(NOW);
    const { result, unmount } = renderHook(() => useRecovery());
    await waitFor(() => expect(result.current.recoveryInfo).not.toBeNull());

    act(() => result.current.dismiss());
    expect(result.current.recoveryInfo).toBeNull();
    await waitFor(async () => expect(await persistenceService.loadPlanSnapshot()).toBeNull());

    const [saved] = await services.plans.forDate('2026-03-10');
    expect(saved.status).toBe('interrupted');
    expect(saved.segments[2]).toMatchObject({ status: 'interrupted', actualDuration: 600 });
    unmount();

    // Next launch: the interrupted plan is stored but was dismissed
    const again = renderHook(() => useRecovery());
    await act(async () => {});
    expect(again.result.current.recoveryInfo).toBeNull();
  });

  it('falls back to an interrupted plan from today when there is no snapshot', async () => {
    const { useRecovery, services, persistenceService } = await load();
    await services.plans.save(planInProgress('interrupted', 'stored'));
    const { result } = renderHook(() => useRecovery());
    await waitFor(() => expect(result.current.recoveryInfo).not.toBeNull());
    expect(result.current.recoveryInfo!.plan.id).toBe('stored');

    let resumed: SessionPlan | null = null;
    act(() => {
      resumed = result.current.resume();
    });
    expect(resumed!.id).toBe('stored');
    expect(result.current.recoveryInfo).toBeNull();
    expect(await persistenceService.loadPlanSnapshot()).toBeNull();
    expect(result.current.resume()).toBeNull(); // only once
  });

  it('never offers finished plans, and clears snapshots that are no longer active', async () => {
    const { useRecovery, services, persistenceService } = await load();
    const done = planInProgress('completed', 'done');
    done.segments = done.segments.map((s) => ({ ...s, status: 'completed' as const }));
    await services.plans.save(done);
    persistenceService.savePlanSnapshot(planInProgress('abandoned', 'old'));

    const { result } = renderHook(() => useRecovery());
    await act(async () => {});
    expect(result.current.recoveryInfo).toBeNull();
    await waitFor(async () => expect(await persistenceService.loadPlanSnapshot()).toBeNull());
  });

  it('clears the snapshot of a plan the user already dismissed', async () => {
    const { useRecovery, persistenceService } = await load();
    localStorage.setItem('FOCUS_RECOVERY_DISMISSED_PLAN_ID', 'plan-1');
    persistenceService.savePlanSnapshot(planInProgress('active'));

    const { result } = renderHook(() => useRecovery());
    await act(async () => {});
    expect(result.current.recoveryInfo).toBeNull();
    await waitFor(async () => expect(await persistenceService.loadPlanSnapshot()).toBeNull());
  });
});
