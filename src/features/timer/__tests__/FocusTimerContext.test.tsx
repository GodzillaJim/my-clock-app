import React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusTimerProvider, useFocusTimerContext } from '../FocusTimerContext';
import { isTimerSpace } from '../isTimerSpace';

vi.mock('@/services/focusStorage', () => ({
  focusStorage: {
    addSession: vi.fn(() => Promise.resolve()),
    saveSessionPlan: vi.fn(() => Promise.resolve()),
    recalculateLifetimeStats: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('@/services/persistenceService', () => ({
  persistenceService: {
    savePlanSnapshot: vi.fn(),
    clearPlanSnapshot: vi.fn(),
  },
}));
vi.mock('@/services/notificationService', () => ({
  notificationService: { showNotification: vi.fn(), playTickSound: vi.fn(() => Promise.resolve()) },
}));

const settings = { focusDuration: 1, shortBreakDuration: 1 };
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FocusTimerProvider initialMinutes={1}>{children}</FocusTimerProvider>
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T09:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('FocusTimerProvider', () => {
  it('startOrResume starts when idle, resumes when paused, and ignores a running timer', () => {
    const { result } = renderHook(() => useFocusTimerContext(), { wrapper });

    act(() => result.current.startOrResume(settings));
    expect(result.current.phase).toBe('running');
    expect(result.current.remainingSeconds).toBe(60);

    act(() => vi.advanceTimersByTime(10_000));
    act(() => result.current.startOrResume(settings)); // running: no restart
    expect(result.current.remainingSeconds).toBe(50);

    act(() => result.current.actions.pause());
    act(() => result.current.startOrResume(settings));
    expect(result.current.phase).toBe('running');
    expect(result.current.remainingSeconds).toBe(50);
  });

  it('startOrResume clears a finished session and starts a new one', () => {
    const { result } = renderHook(() => useFocusTimerContext(), { wrapper });
    act(() => result.current.startOrResume(settings));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.phase).toBe('complete');

    act(() => result.current.startOrResume(settings));
    expect(result.current.phase).toBe('running');
    expect(result.current.remainingSeconds).toBe(60);
  });

  it('toggle pauses a running timer and otherwise starts or resumes', () => {
    const { result } = renderHook(() => useFocusTimerContext(), { wrapper });
    act(() => result.current.toggle(settings));
    expect(result.current.phase).toBe('running');
    act(() => result.current.toggle(settings));
    expect(result.current.phase).toBe('paused');
    act(() => result.current.toggle(settings));
    expect(result.current.phase).toBe('running');
  });

  it('uses the planned length chosen with the presets', () => {
    const { result } = renderHook(() => useFocusTimerContext(), { wrapper });
    act(() => result.current.setPlannedMinutes(3));
    act(() => result.current.startOrResume(settings));
    expect(result.current.segmentCount).toBe(3); // 1m focus, 1m break, 1m focus
  });

  it('keeps a running session when the view that shows it unmounts', () => {
    const Probe = () => {
      const { phase, remainingSeconds } = useFocusTimerContext();
      return <span>{`${phase}:${remainingSeconds}`}</span>;
    };
    const Starter = () => {
      const { startOrResume } = useFocusTimerContext();
      React.useEffect(() => startOrResume(settings), [startOrResume]);
      return null;
    };
    const { rerender, container } = render(
      <FocusTimerProvider initialMinutes={1}>
        <Starter />
        <Probe />
      </FocusTimerProvider>,
    );
    act(() => vi.advanceTimersByTime(5000));
    // Switch to another tool: the view goes away...
    rerender(<FocusTimerProvider initialMinutes={1}>{null}</FocusTimerProvider>);
    act(() => vi.advanceTimersByTime(5000));
    // ...and comes back to a session that kept running
    rerender(
      <FocusTimerProvider initialMinutes={1}>
        <Probe />
      </FocusTimerProvider>,
    );
    expect(container.textContent).toBe('running:50');
  });

  it('must be used inside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFocusTimerContext())).toThrow(/FocusTimerProvider/);
  });
});

describe('isTimerSpace', () => {
  const space = (target: EventTarget, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, ...init });
    Object.defineProperty(event, 'target', { value: target });
    return event;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('controls the timer when nothing interactive has focus', () => {
    expect(isTimerSpace(space(document.body), 0, false)).toBe(true);
  });

  it('leaves Space to focused controls', () => {
    document.body.innerHTML =
      '<button id="b"><span id="inner">x</span></button><input id="i"/><div role="tab" id="t"></div>';
    for (const id of ['b', 'inner', 'i', 't']) {
      expect(isTimerSpace(space(document.getElementById(id)!), 0, false)).toBe(false);
    }
  });

  it('is off on other tools, with history or a dialog open, and for modified or repeated keys', () => {
    expect(isTimerSpace(space(document.body), 1, false)).toBe(false);
    expect(isTimerSpace(space(document.body), 0, true)).toBe(false);
    expect(isTimerSpace(space(document.body, { ctrlKey: true }), 0, false)).toBe(false);
    expect(isTimerSpace(space(document.body, { repeat: true }), 0, false)).toBe(false);
    expect(isTimerSpace(new KeyboardEvent('keydown', { key: 'Enter' }), 0, false)).toBe(false);
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(isTimerSpace(space(document.body), 0, false)).toBe(false);
  });
});
