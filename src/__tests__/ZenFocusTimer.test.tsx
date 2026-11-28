import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZenFocusTimer } from '@/components/timer/ZenFocusTimer';
import { FocusTimerProvider, useFocusTimerContext } from '@/features/timer/FocusTimerContext';
import { AppSettings, DEFAULT_SETTINGS, SessionPlan, SessionType } from '@/features/timer/types';

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

vi.mock('@/services/domain', () => ({
  services: {
    sessions: { add: mocks.focusStorage.addSession },
    plans: { save: mocks.focusStorage.saveSessionPlan },
    stats: { recalculate: mocks.focusStorage.recalculateLifetimeStats },
  },
}));
vi.mock('@/services/persistenceService', () => ({ persistenceService: mocks.persistenceService }));
vi.mock('@/services/notificationService', () => ({
  notificationService: mocks.notificationService,
}));

const baseSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  focusDuration: 25,
  shortBreakDuration: 5,
  quickPresets: [15, 25, 50],
};

/** Resumes plan through the shared timer once mounted, as App does for History/recovery. */
const ResumeOnMount: React.FC<{ plan: SessionPlan }> = ({ plan }) => {
  const { actions } = useFocusTimerContext();
  React.useEffect(() => actions.resumePlan(plan), [actions, plan]);
  return null;
};

const renderTimer = (settings: AppSettings = baseSettings, resumePlan?: SessionPlan) =>
  render(
    <FocusTimerProvider initialMinutes={settings.focusDuration}>
      <ZenFocusTimer onOpenSettings={() => {}} onOpenHistory={() => {}} settings={settings} />
      {resumePlan && <ResumeOnMount plan={resumePlan} />}
    </FocusTimerProvider>,
  );

/** Advance fake time and flush the React updates it triggers. */
const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

/** The plan object passed to the most recent saveSessionPlan call. */
const lastSavedPlan = (): SessionPlan => {
  const calls = mocks.focusStorage.saveSessionPlan.mock.calls as unknown as [SessionPlan][];
  return calls[calls.length - 1][0];
};

const pauseButton = () => screen.getByTestId('PauseIcon').closest('button')!;

describe('ZenFocusTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T09:00:00'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders idle with the default focus duration', () => {
    renderTimer();

    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start 25m focus/i })).toBeInTheDocument();
    for (const preset of ['15m', '25m', '50m']) {
      expect(screen.getByRole('button', { name: preset })).toBeInTheDocument();
    }
  });

  it('changes the planned duration with a quick preset', () => {
    renderTimer();

    fireEvent.click(screen.getByRole('button', { name: '50m' }));

    expect(screen.getByText('50:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start 50m focus/i })).toBeInTheDocument();
  });

  it('starts a focus session, counts down and persists the plan', async () => {
    renderTimer();

    fireEvent.click(screen.getByRole('button', { name: /start 25m focus/i }));

    expect(screen.getByText('FOCUS')).toBeInTheDocument();

    await tick(1000);
    expect(screen.getByText('24:59')).toBeInTheDocument();

    const plan = lastSavedPlan();
    expect(plan.status).toBe('active');
    expect(plan.currentSegmentIndex).toBe(0);
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0]).toMatchObject({
      type: SessionType.FOCUS,
      plannedDuration: 25 * 60,
      status: 'in_progress',
    });
    expect(mocks.persistenceService.savePlanSnapshot).toHaveBeenCalledWith(plan);
    expect(mocks.notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_start', title: 'Focus Started' }),
    );
  });

  it('transitions from focus to break when the focus segment ends', async () => {
    // 15 minutes of 1m focus / 5m break → F B F B F B(2m) = 6 segments
    renderTimer({ ...baseSettings, focusDuration: 1, shortBreakDuration: 5 });

    fireEvent.click(screen.getByRole('button', { name: '15m' }));
    fireEvent.click(screen.getByRole('button', { name: /start 15m focus/i }));

    expect(screen.getByText('FOCUS')).toBeInTheDocument();
    expect(screen.getByText('1 / 6')).toBeInTheDocument();

    // The switch happens exactly when the focus minute is used up
    await tick(60 * 1000);

    expect(screen.getByText('BREAK')).toBeInTheDocument();
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();

    // The break counts down from its full length
    await tick(1000);
    expect(screen.getByText('04:59')).toBeInTheDocument();

    expect(mocks.focusStorage.addSession).toHaveBeenCalledWith(
      expect.objectContaining({ type: SessionType.FOCUS, sessionNumber: 1 }),
    );
    expect(mocks.notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'break_complete', title: 'Break Time!' }),
    );

    const plan = lastSavedPlan();
    expect(plan.currentSegmentIndex).toBe(1);
    expect(plan.segments[0].status).toBe('completed');
    expect(plan.segments[1].status).toBe('in_progress');
  });

  it('freezes the countdown while paused and continues on resume', async () => {
    renderTimer();

    fireEvent.click(screen.getByRole('button', { name: /start 25m focus/i }));
    await tick(1000);
    expect(screen.getByText('24:59')).toBeInTheDocument();

    fireEvent.click(pauseButton());
    await tick(5000);

    expect(screen.getByText('24:59')).toBeInTheDocument();
    const resume = screen.getByRole('button', { name: /resume/i });

    fireEvent.click(resume);
    await tick(1000);

    expect(screen.getByText('24:58')).toBeInTheDocument();
  });

  it('skips to the next segment', async () => {
    renderTimer({ ...baseSettings, focusDuration: 1, shortBreakDuration: 5 });

    fireEvent.click(screen.getByRole('button', { name: '15m' }));
    fireEvent.click(screen.getByRole('button', { name: /start 15m focus/i }));
    await tick(1000);

    fireEvent.click(screen.getByRole('button', { name: /skip to next/i }));
    await tick(1000);

    expect(screen.getByText('BREAK')).toBeInTheDocument();
    expect(screen.getByText('2 / 6')).toBeInTheDocument();

    const plan = lastSavedPlan();
    expect(plan.segments[0].status).toBe('skipped');
    expect(plan.segments[1].status).toBe('in_progress');
  });

  it('stops a session, abandons the plan and returns to idle', async () => {
    renderTimer();

    fireEvent.click(screen.getByRole('button', { name: /start 25m focus/i }));
    await tick(3000);

    fireEvent.click(screen.getByRole('button', { name: /stop session/i }));
    await tick(0);

    const plan = lastSavedPlan();
    expect(plan.status).toBe('abandoned');
    expect(plan.segments[0].status).toBe('interrupted');
    expect(mocks.persistenceService.clearPlanSnapshot).toHaveBeenCalled();
    expect(mocks.focusStorage.addSession).toHaveBeenCalledWith(
      expect.objectContaining({ completionStatus: 'interrupted' }),
    );

    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start 25m focus/i })).toBeInTheDocument();
  });

  it('ticks once per second during the last 10 seconds only', async () => {
    renderTimer({ ...baseSettings, focusDuration: 1, quickPresets: [1, 5] });

    fireEvent.click(screen.getByRole('button', { name: /start 1m focus/i }));
    await tick(49 * 1000); // 11s remaining
    expect(mocks.notificationService.playTickSound).not.toHaveBeenCalled();

    for (let i = 0; i < 10; i++) await tick(1000); // 10s → 1s remaining, one render per second
    expect(mocks.notificationService.playTickSound).toHaveBeenCalledTimes(10);
  });

  it('shows the completion screen after the final segment and can start over', async () => {
    renderTimer({ ...baseSettings, focusDuration: 1, quickPresets: [1, 5] });

    fireEvent.click(screen.getByRole('button', { name: /start 1m focus/i }));
    await tick(61 * 1000);

    expect(screen.getByText('Session Complete!')).toBeInTheDocument();

    const plan = lastSavedPlan();
    expect(plan.status).toBe('completed');
    expect(plan.segments[0].status).toBe('completed');
    expect(mocks.persistenceService.clearPlanSnapshot).toHaveBeenCalled();
    expect(mocks.focusStorage.recalculateLifetimeStats).toHaveBeenCalled();
    expect(mocks.notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_complete' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /start new session/i }));
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('resumes the remaining work of an interrupted plan', async () => {
    const start = Date.now() - 10 * 60 * 1000;
    const interrupted: SessionPlan = {
      id: 'old-plan',
      createdAt: start,
      status: 'interrupted',
      currentSegmentIndex: 0,
      settings: { focusDuration: 25, shortBreakDuration: 5 },
      segments: [
        {
          id: 'seg-0',
          index: 0,
          type: SessionType.FOCUS,
          plannedDuration: 25 * 60,
          actualDuration: null,
          expectedStartTime: start,
          expectedEndTime: start + 25 * 60 * 1000,
          actualStartTime: start,
          actualEndTime: null,
          status: 'interrupted',
          pausedTime: 0,
          elapsedAtLastUpdate: 10 * 60,
        },
        {
          id: 'seg-1',
          index: 1,
          type: SessionType.SHORT_BREAK,
          plannedDuration: 5 * 60,
          actualDuration: null,
          expectedStartTime: start + 25 * 60 * 1000,
          expectedEndTime: start + 30 * 60 * 1000,
          actualStartTime: null,
          actualEndTime: null,
          status: 'pending',
          pausedTime: 0,
          elapsedAtLastUpdate: 0,
        },
      ],
      expectedEndTime: start + 30 * 60 * 1000,
      actualEndTime: null,
      interruptedAt: Date.now(),
      totalPlannedDuration: 30 * 60,
      totalElapsed: 10 * 60,
      lastUpdated: Date.now(),
    };
    renderTimer(baseSettings, interrupted);
    await tick(1000);

    expect(screen.getByText('FOCUS')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // 15 minutes of focus remained; one second has elapsed since resuming
    expect(screen.getByText('14:59')).toBeInTheDocument();

    const saved = (mocks.focusStorage.saveSessionPlan.mock.calls as unknown as [SessionPlan][]).map(
      (c) => c[0],
    );
    const oldFinal = saved.find((p) => p.id === 'old-plan')!;
    expect(oldFinal.segments.map((s) => s.status)).toEqual(['skipped', 'skipped']);
    const resumed = saved.find((p) => p.id !== 'old-plan')!;
    expect(resumed.segments.map((s) => s.plannedDuration)).toEqual([15 * 60, 5 * 60]);
  });
});
