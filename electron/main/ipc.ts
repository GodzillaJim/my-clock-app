import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { InvokeArgs, InvokeChannel, InvokeResult } from '../ipc/contract';
import { ipcArgSchemas } from './ipcSchemas';
import { createLogger } from './logger';
import { parseIpcArgs } from './ipcValidation';
import { isTrustedSender } from './security';

const log = createLogger('ipc');

/** True when the message comes from the app's own top-level page. */
export function fromTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  const trusted = isTrustedSender(
    frame?.url,
    !!frame && frame === event.sender.mainFrame,
    process.env.VITE_DEV_SERVER_URL,
  );
  if (!trusted) log.warn('Rejected IPC from untrusted sender:', frame?.url ?? '(no frame)');
  return trusted;
}

/**
 * Registers a handler for a contract channel. The sender must be the app's own
 * page, and the arguments must match the channel's schema; anything else is
 * logged and rejected without reaching the handler.
 */
export function handle<C extends InvokeChannel>(
  channel: C,
  handler: (...args: InvokeArgs<C>) => InvokeResult<C> | Promise<InvokeResult<C>>,
): void {
  ipcMain.handle(channel, (event, ...rawArgs: unknown[]) => {
    if (!fromTrustedSender(event)) throw new Error(`Untrusted sender for ${channel}`);
    const parsed = parseIpcArgs(channel, ipcArgSchemas[channel], rawArgs);
    if (!parsed.ok) {
      log.warn(parsed.error);
      throw new Error(parsed.error);
    }
    return handler(...parsed.args);
  });
}
