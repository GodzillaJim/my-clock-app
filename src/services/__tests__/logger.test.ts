import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureGlobalErrors, createLogger, serializeLogArg } from '../logger';
import { parseRendererLog } from '../../../electron/main/logMessage';

describe('serializeLogArg', () => {
  it('keeps primitives as they are', () => {
    expect(serializeLogArg('text')).toBe('text');
    expect(serializeLogArg(42)).toBe(42);
    expect(serializeLogArg(false)).toBe(false);
    expect(serializeLogArg(null)).toBeNull();
    expect(serializeLogArg(undefined)).toBeUndefined();
  });

  it('turns errors into their stack trace', () => {
    const err = new Error('boom');
    expect(serializeLogArg(err)).toBe(err.stack);
  });

  it('copies plain objects and stringifies what cannot be cloned', () => {
    expect(serializeLogArg({ a: 1, when: new Date(0) })).toEqual({
      a: 1,
      when: '1970-01-01T00:00:00.000Z',
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(serializeLogArg(circular)).toBe('[object Object]');
    expect(typeof serializeLogArg(() => 1)).toBe('string');
  });
});

describe('createLogger', () => {
  afterEach(() => {
    delete window.electronAPI;
    vi.restoreAllMocks();
  });

  it('forwards serialized messages to the Electron bridge', () => {
    const send = vi.fn();
    window.electronAPI = { log: send } as unknown as NonNullable<Window['electronAPI']>;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    createLogger('timer').warn('Failed:', new Error('x'), { id: 1 });

    expect(send).toHaveBeenCalledWith('warn', 'timer', [
      'Failed:',
      expect.stringContaining('Error: x'),
      { id: 1 },
    ]);
  });

  it('falls back to the console without a bridge', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    createLogger('storage').error('Load failed');
    expect(consoleError).toHaveBeenCalledWith('[storage]', 'Load failed');
  });

  it('never throws when the bridge fails', () => {
    window.electronAPI = {
      log: () => {
        throw new Error('IPC closed');
      },
    } as unknown as NonNullable<Window['electronAPI']>;
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(() => createLogger('x').info('hello')).not.toThrow();
  });
});

describe('captureGlobalErrors', () => {
  afterEach(() => {
    delete window.electronAPI;
    vi.restoreAllMocks();
  });

  it('logs uncaught errors, rejections and CSP violations', () => {
    const send = vi.fn();
    window.electronAPI = { log: send } as unknown as NonNullable<Window['electronAPI']>;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    captureGlobalErrors();

    window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    const rejection = Object.assign(new Event('unhandledrejection'), { reason: 'nope' });
    window.dispatchEvent(rejection);
    const inline = Object.assign(new Event('securitypolicyviolation'), {
      violatedDirective: 'script-src',
      blockedURI: '',
    });
    document.dispatchEvent(inline);
    const remote = Object.assign(new Event('securitypolicyviolation'), {
      violatedDirective: 'img-src',
      blockedURI: 'https://example.com/x.png',
    });
    document.dispatchEvent(remote);

    expect(send.mock.calls).toEqual([
      ['error', 'window', ['Uncaught error:', 'boom']],
      ['error', 'window', ['Unhandled promise rejection:', 'nope']],
      ['warn', 'window', ['CSP violation:', 'script-src', '(inline)']],
      ['warn', 'window', ['CSP violation:', 'img-src', 'https://example.com/x.png']],
    ]);
  });
});

describe('parseRendererLog (main process)', () => {
  it('accepts well-formed messages', () => {
    expect(parseRendererLog('info', 'timer', ['a', 1])).toEqual({
      level: 'info',
      scope: 'timer',
      args: ['a', 1],
    });
  });

  it('rejects unknown levels, bad scopes and non-array args', () => {
    expect(parseRendererLog('silly', 'timer', [])).toBeNull();
    expect(parseRendererLog('info', '', [])).toBeNull();
    expect(parseRendererLog('info', 'x'.repeat(65), [])).toBeNull();
    expect(parseRendererLog('info', 42, [])).toBeNull();
    expect(parseRendererLog('info', 'timer', 'not-an-array')).toBeNull();
  });

  it('caps the number of arguments', () => {
    const parsed = parseRendererLog(
      'debug',
      'timer',
      Array.from({ length: 50 }, (_, i) => i),
    );
    expect(parsed?.args).toHaveLength(20);
  });
});
