import { ipcMain } from 'electron';
import type { InvokeArgs, InvokeChannel, InvokeResult } from '../ipc/contract';
import { ipcArgSchemas } from './ipcSchemas';
import { createLogger } from './logger';
import { parseIpcArgs } from './ipcValidation';

const log = createLogger('ipc');

/**
 * Registers a handler for a contract channel. Arguments are validated against
 * the channel's schema first; invalid calls are logged and rejected without
 * reaching the handler.
 */
export function handle<C extends InvokeChannel>(
  channel: C,
  handler: (...args: InvokeArgs<C>) => InvokeResult<C> | Promise<InvokeResult<C>>,
): void {
  ipcMain.handle(channel, (_event, ...rawArgs: unknown[]) => {
    const parsed = parseIpcArgs(channel, ipcArgSchemas[channel], rawArgs);
    if (!parsed.ok) {
      log.warn(parsed.error);
      throw new Error(parsed.error);
    }
    return handler(...parsed.args);
  });
}
