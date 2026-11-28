import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FocusTimerProvider, useFocusTimerContext } from '@/features/timer/FocusTimerContext';

const mocks = vi.hoisted(() => ({
  savePlanSnapshot: vi.fn(),
}));

vi.mock('@/services/domain', () => ({
  services: {
    sessions: { add: vi.fn(() => Promise.resolve()) },
    plans: { save: vi.fn(() => Promise.resolve()) },
    stats: { recalculate: vi.fn(() => Promise.resolve()) },
  },
}));
vi.mock('@/services/persistenceService', () => ({
  persistenceService: {
    savePlanSnapshot: mocks.savePlanSnapshot,
    clearPlanSnapshot: vi.fn(),
  },
}));
vi.mock('@/services/notificationService', () => ({
  notificationService: { showNotification: vi.fn(), playTickSound: vi.fn(() => Promise.resolve()) },
}));

let shouldThrow = true;
const Bomb = () => {
  if (shouldThrow) throw new Error('kaboom');
  return <p>recovered</p>;
};

beforeEach(() => {
  shouldThrow = true;
  // React reports caught render errors to console.error; keep test output clean
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ErrorBoundary', () => {
  it('shows a recovery screen instead of a blank window, and reports the error', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'kaboom' }));
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
  });

  it('"Try again" renders the children again', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('offers only a reload when retrying cannot help', () => {
    render(
      <ErrorBoundary allowRetry={false}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('survives a failing error handler', () => {
    render(
      <ErrorBoundary
        onError={() => {
          throw new Error('handler broke');
        }}
      >
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('keeps a running focus session through a UI crash and saves its progress', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T09:00:00'));
    let crash = false;
    const View = () => {
      const { phase, remainingSeconds, startOrResume } = useFocusTimerContext();
      React.useEffect(
        () => startOrResume({ focusDuration: 1, shortBreakDuration: 1 }),
        [startOrResume],
      );
      if (crash) throw new Error('view crashed');
      return <p>{`${phase}:${remainingSeconds}`}</p>;
    };
    const Boundary = ({ children }: { children: React.ReactNode }) => {
      const { actions } = useFocusTimerContext();
      return <ErrorBoundary onError={actions.flushSnapshot}>{children}</ErrorBoundary>;
    };
    const ui = (
      <FocusTimerProvider initialMinutes={1}>
        <Boundary>
          <View />
        </Boundary>
      </FocusTimerProvider>
    );
    render(ui);
    act(() => vi.advanceTimersByTime(10_000));
    mocks.savePlanSnapshot.mockClear();

    // The next clock tick re-renders the view, which now throws
    crash = true;
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Progress was written out when the error was caught
    expect(mocks.savePlanSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        segments: [expect.objectContaining({ elapsedAtLastUpdate: 10 })],
      }),
    );

    // The timer kept running behind the recovery screen
    act(() => vi.advanceTimersByTime(5000));
    crash = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('running:45')).toBeInTheDocument();
  });
});
