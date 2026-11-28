import type { z } from 'zod';

type ParseResult<T> = { ok: true; args: T } | { ok: false; error: string };

/** Validates raw IPC arguments; the error names the channel and the first few issues. */
export function parseIpcArgs<T>(
  channel: string,
  schema: z.ZodType<T>,
  rawArgs: unknown[],
): ParseResult<T> {
  const result = schema.safeParse(rawArgs);
  if (result.success) return { ok: true, args: result.data };
  const issues = result.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '(args)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, error: `Invalid arguments for ${channel}: ${issues}` };
}
