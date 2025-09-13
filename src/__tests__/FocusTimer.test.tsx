import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FocusTimer } from '@/components/timer/FocusTimer';
import { AppSettings, DEFAULT_SETTINGS } from '@/features/timer/types';
import { notificationService } from '@/services/notificationService';

// Mock CompletionScreen to avoid complexities in this test
vi.mock('@/components/timer/CompletionScreen', () => ({
  CompletionScreen: ({ onStartNewSession }: { onStartNewSession: () => void }) => (
    <div>
      <h1>Session Complete!</h1>
      <button onClick={onStartNewSession}>Start New Session</button>
    </div>
  ),
}));

// Mock notification service
vi.mock('@/services/notificationService');

const mockSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  focusDuration: 25,
  shortBreakDuration: 5,
  autoStartBreaks: true,
  autoStartNextSession: true,
  quickPresets: [15, 25, 50],
};

describe('FocusTimer', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders the timer with default total duration', () => {
    render(
      <FocusTimer
        onOpenSettings={() => {}}
        onOpenHistory={() => {}}
        onOpenFeedback={() => {}}
        settings={mockSettings}
      />
    );

    // Check for the duration input display
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('minutes')).toBeInTheDocument();

    // Check for the main timer display, which should also show 25:00 initially
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('allows changing the total duration using buttons', () => {
    render(
      <FocusTimer
        onOpenSettings={() => {}}
        onOpenHistory={() => {}}
        onOpenFeedback={() => {}}
        settings={mockSettings}
      />
    );

    const increaseButton = screen.getByRole('button', { name: /increase duration/i });
    const decreaseButton = screen.getByRole('button', { name: /decrease duration/i });

    fireEvent.click(increaseButton);
    expect(screen.getByText('30')).toBeInTheDocument();

    fireEvent.click(decreaseButton);
    fireEvent.click(decreaseButton);
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('allows changing the total duration using quick presets', () => {
    render(
      <FocusTimer
        onOpenSettings={() => {}}
        onOpenHistory={() => {}}
        onOpenFeedback={() => {}}
        settings={mockSettings}
      />
    );

    const presetButton = screen.getByRole('button', { name: '50m' });
    fireEvent.click(presetButton);

    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('starts the timer and shows the first session as focus', async () => {
    vi.useFakeTimers();
    render(
      <FocusTimer
        onOpenSettings={() => {}}
        onOpenHistory={() => {}}
        onOpenFeedback={() => {}}
        settings={mockSettings}
      />
    );

    const startButton = screen.getByRole('button', { name: /start 25min focus/i });
    fireEvent.click(startButton);

    expect(screen.getByText('Focus Session')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText('24:59')).toBeInTheDocument();
    });
  });

  it('transitions from focus to break session', async () => {
    vi.useFakeTimers();
    const shortFocusSettings: AppSettings = { ...mockSettings, focusDuration: 1, shortBreakDuration: 5 };

    render(
      <FocusTimer
        onOpenSettings={() => {}}
        onOpenHistory={() => {}}
        onOpenFeedback={() => {}}
        settings={shortFocusSettings}
      />
    );

    // Set total duration to be long enough for a focus and break
    fireEvent.click(screen.getByRole('button', { name: '15m' }));

    const startButton = screen.getByRole('button', { name: /start 15min focus/i });
    fireEvent.click(startButton);

    expect(screen.getByText('Focus Session')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('01:00')).toBeInTheDocument());

    // Advance time to complete the focus session
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(screen.getByText('Break Session')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('05:00')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(notificationService.showNotification).toHaveBeenCalled();
    });
  });
});
