import type { EventEmitter } from 'node:events';

interface PowerWindow {
  isDestroyed(): boolean;
  webContents: { send(channel: 'system-suspend', suspendedAt: number): void };
  on(event: 'closed', listener: () => void): unknown;
}

interface PowerLog {
  info(...args: unknown[]): void;
}

/**
 * Tells the renderer when the system goes to sleep, so a running session
 * pauses at that moment (the renderer may only process it after waking).
 * Stops listening when the window closes.
 */
export function forwardPowerEvents(
  monitor: Pick<EventEmitter, 'on' | 'off'>,
  window: PowerWindow,
  log: PowerLog,
  now: () => number = Date.now,
): void {
  const onSuspend = () => {
    log.info('System suspending');
    if (!window.isDestroyed()) window.webContents.send('system-suspend', now());
  };
  const onResume = () => log.info('System resumed');
  monitor.on('suspend', onSuspend);
  monitor.on('resume', onResume);
  window.on('closed', () => {
    monitor.off('suspend', onSuspend);
    monitor.off('resume', onResume);
  });
}
