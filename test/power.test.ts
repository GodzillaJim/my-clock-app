import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { forwardPowerEvents } from '../electron/main/power';

function fakeWindow() {
  const events = new EventEmitter();
  return {
    destroyed: false,
    send: vi.fn(),
    isDestroyed() {
      return this.destroyed;
    },
    webContents: { send: (...args: unknown[]) => fakeWindowSend(args) },
    on: (event: 'closed', listener: () => void) => events.on(event, listener),
    close: () => events.emit('closed'),
  };
}
let fakeWindowSend: (args: unknown[]) => void;

describe('forwardPowerEvents', () => {
  it('sends the suspend time to the renderer and logs sleep and wake', () => {
    const monitor = new EventEmitter();
    const window = fakeWindow();
    fakeWindowSend = window.send;
    const log = { info: vi.fn() };
    forwardPowerEvents(monitor, window, log, () => 1234);

    monitor.emit('suspend');
    expect(window.send).toHaveBeenCalledWith(['system-suspend', 1234]);
    monitor.emit('resume');
    expect(log.info.mock.calls.map((c) => c[0])).toEqual(['System suspending', 'System resumed']);
  });

  it('skips a destroyed window and stops listening once it closes', () => {
    const monitor = new EventEmitter();
    const window = fakeWindow();
    fakeWindowSend = window.send;
    forwardPowerEvents(monitor, window, { info: vi.fn() });

    window.destroyed = true;
    monitor.emit('suspend');
    expect(window.send).not.toHaveBeenCalled();

    window.close();
    expect(monitor.listenerCount('suspend')).toBe(0);
    expect(monitor.listenerCount('resume')).toBe(0);
  });
});
