import path from 'node:path';
import { app, ipcMain } from 'electron';
import log from 'electron-log/main';
import { parseRendererLog } from './logMessage';

/**
 * Application logger. Writes to `<userData>/logs/main.log` (rotated to
 * `main.old.log` at 5 MB) and, in development, to the terminal.
 */
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.level = 'info';
log.transports.console.level = app.isPackaged ? false : 'debug';

/** Starts crash/error capture and the channel the renderer logs through. */
export function initLogging(): void {
  log.errorHandler.startCatching({ showDialog: false });
  log.eventLogger.startLogging();

  ipcMain.on('log:write', (_event, level: unknown, scope: unknown, args: unknown) => {
    const entry = parseRendererLog(level, scope, args);
    if (!entry) return;
    log.scope(`renderer:${entry.scope}`)[entry.level](...entry.args);
  });

  log.info(`Focus Sessions ${app.getVersion()} starting (${process.platform} ${process.arch})`);
}

export function createLogger(scope: string) {
  return log.scope(scope);
}
