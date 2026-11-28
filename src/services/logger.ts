/**
 * Renderer logger. Messages go to the main process, which writes them to the
 * rotating log file under `<userData>/logs`. During development, and whenever
 * the Electron bridge is missing (tests, plain browser), they are also printed
 * to the console.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

/** Converts a log argument into something that survives IPC structured cloning. */
export function serializeLogArg(arg: unknown): unknown {
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') return arg;
  if (typeof arg === 'object') {
    try {
      return JSON.parse(JSON.stringify(arg)) as unknown;
    } catch {
      // Circular or otherwise unserializable
    }
  }
  return String(arg);
}

export function createLogger(scope: string): Logger {
  const write = (level: LogLevel, args: unknown[]) => {
    const bridge = typeof window !== 'undefined' ? window.electronAPI?.log : undefined;
    if (bridge) {
      try {
        bridge(level, scope, args.map(serializeLogArg));
      } catch {
        // Logging must never break the caller
      }
    }
    if (!bridge || import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- the logger's own console sink
      console[level](`[${scope}]`, ...args);
    }
  };

  return {
    error: (...args) => write('error', args),
    warn: (...args) => write('warn', args),
    info: (...args) => write('info', args),
    debug: (...args) => write('debug', args),
  };
}

/** Sends uncaught renderer errors and CSP violations to the log file. */
export function captureGlobalErrors(): void {
  const log = createLogger('window');
  document.addEventListener('securitypolicyviolation', (event) => {
    log.warn('CSP violation:', event.violatedDirective, event.blockedURI || '(inline)');
  });
  window.addEventListener('error', (event) => {
    log.error('Uncaught error:', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    log.error('Unhandled promise rejection:', event.reason);
  });
}
