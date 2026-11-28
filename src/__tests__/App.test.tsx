import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { FocusTimerProvider } from '@/features/timer/FocusTimerContext';
import { getTodayDateString } from '@/features/timer/types';
import { emptyDay, emptyLifetimeStats } from '@/features/stats/stats';

const mocks = vi.hoisted(() => ({
  settings: { focusDuration: 30 },
}));

vi.mock('@/services/domain', () => ({
  services: {
    settings: {
      load: vi.fn(async () => {
        const { DEFAULT_SETTINGS: defaults } = await import('@/features/timer/types');
        return {
          version: '1.0.0',
          currentSession: null,
          dailyHistory: null,
          settings: { ...defaults, ...mocks.settings, enableSystemNotifications: false },
          lastActiveDate: '',
        };
      }),
      save: vi.fn(() => Promise.resolve()),
    },
    plans: {
      reconcileOrphans: vi.fn(() => Promise.resolve([])),
      forDate: vi.fn(() => Promise.resolve([])),
      save: vi.fn(() => Promise.resolve()),
    },
    history: {
      today: vi.fn(async () => emptyDay(getTodayDateString(), Date.now())),
      byDate: vi.fn(() => Promise.resolve(null)),
      forPeriod: vi.fn(() => Promise.resolve([])),
    },
    stats: {
      get: vi.fn(() => Promise.resolve(emptyLifetimeStats())),
      recalculate: vi.fn(() => Promise.resolve(emptyLifetimeStats())),
    },
    sessions: { add: vi.fn(() => Promise.resolve()) },
    challenges: { list: vi.fn(() => Promise.resolve([])) },
  },
}));
vi.mock('@/services/persistenceService', () => ({
  persistenceService: {
    savePlanSnapshot: vi.fn(),
    clearPlanSnapshot: vi.fn(),
    loadPlanSnapshot: vi.fn(() => Promise.resolve(null)),
  },
}));
vi.mock('@/services/notificationService', () => ({
  notificationService: {
    setSettings: vi.fn(),
    requestPermission: vi.fn(() => Promise.resolve(true)),
    getPermissionStatus: vi.fn(() => 'granted'),
    showNotification: vi.fn(),
    playTickSound: vi.fn(() => Promise.resolve()),
  },
}));

beforeEach(() => {
  // jsdom has no matchMedia; MUI's useMediaQuery needs it
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    media: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
});

afterEach(() => vi.clearAllMocks());

const renderApp = () =>
  render(
    <FocusTimerProvider>
      <App />
    </FocusTimerProvider>,
  );

describe('App', () => {
  it('loads saved settings and shows the idle Zen timer with the saved duration', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: 'Start focus' })).toBeInTheDocument();
    expect(await screen.findByText('30:00')).toBeInTheDocument();
    expect(screen.getByTestId('timer-status')).toHaveTextContent('Ready');
  });

  it('opens settings and history on demand, loading them when first needed', async () => {
    renderApp();
    await screen.findByRole('button', { name: 'Start focus' });

    fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    // Lazy chunks: allow for a loaded machine running the suite in parallel
    expect(
      await screen.findByText('Focus Sessions Settings', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.keyDown(document, { key: 'h', ctrlKey: true });
    expect(
      await screen.findByRole('button', { name: 'Back' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  }, 15_000);

  it('switches tools with Ctrl+number', async () => {
    renderApp();
    await screen.findByRole('button', { name: 'Start focus' });
    fireEvent.keyDown(document, { key: '3', ctrlKey: true });
    expect(await screen.findByRole('button', { name: /^start$/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: '1', ctrlKey: true });
    expect(await screen.findByRole('button', { name: 'Start focus' })).toBeInTheDocument();
  });

  it('renders the saved layout', async () => {
    mocks.settings = { focusDuration: 30, layout: 'commandCenter' } as never;
    renderApp();
    expect(await screen.findByText('Session Plan')).toBeInTheDocument();
    mocks.settings = { focusDuration: 30 };
  });
});
