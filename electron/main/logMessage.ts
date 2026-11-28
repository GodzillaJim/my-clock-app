export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const MAX_SCOPE_LENGTH = 64;
const MAX_ARGS = 20;

/**
 * Validates a log message sent by the renderer over IPC.
 * Returns null when it is malformed, so it can be dropped.
 */
export function parseRendererLog(
  level: unknown,
  scope: unknown,
  args: unknown,
): { level: LogLevel; scope: string; args: unknown[] } | null {
  if (!LOG_LEVELS.includes(level as LogLevel)) return null;
  if (typeof scope !== 'string' || scope.length === 0 || scope.length > MAX_SCOPE_LENGTH) {
    return null;
  }
  if (!Array.isArray(args)) return null;
  return { level: level as LogLevel, scope, args: args.slice(0, MAX_ARGS) };
}
