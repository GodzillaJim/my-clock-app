import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, type BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import { handle } from './ipc';
import { backupDatabase } from './database/migrationRunner';
import {
  MAX_IMPORT_BYTES,
  exportData,
  importData,
  listBackups,
  restoreBackup,
} from './database/dataTransfer';
import { createLogger } from './logger';

const log = createLogger('data');

/**
 * Export, import, backup and restore. File choice and confirmation happen
 * here, in native dialogs: the renderer never supplies a path, and restore
 * only accepts the name of an existing backup.
 */
export function registerDataHandlers(db: Database.Database, getWindow: () => BrowserWindow | null) {
  const userData = app.getPath('userData');
  const dirs = { backups: path.join(userData, 'backups'), scratch: path.join(userData, 'scratch') };

  const confirm = async (message: string, detail: string, action: string) => {
    const win = getWindow();
    const options = {
      type: 'warning' as const,
      title: 'Focus Sessions',
      message,
      detail,
      buttons: [action, 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    };
    const { response } = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options);
    return response === 0;
  };

  handle('data:export', async () => {
    const date = new Date().toISOString().split('T')[0];
    const options = {
      title: 'Export Focus Sessions data',
      defaultPath: path.join(app.getPath('documents'), `focus-sessions-export-${date}.json`),
      filters: [{ name: 'Focus Sessions export', extensions: ['json'] }],
    };
    const win = getWindow();
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return { status: 'cancelled' as const };
    fs.writeFileSync(filePath, JSON.stringify(exportData(db, app.getVersion()), null, 2));
    log.info('Exported data');
    return { status: 'done' as const, fileName: path.basename(filePath) };
  });

  handle('data:import', async () => {
    const options = {
      title: 'Import Focus Sessions data',
      properties: ['openFile' as const],
      filters: [{ name: 'Focus Sessions export', extensions: ['json'] }],
    };
    const win = getWindow();
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (canceled || filePaths.length === 0) return { status: 'cancelled' as const };
    const file = filePaths[0];
    if (fs.statSync(file).size > MAX_IMPORT_BYTES) throw new Error('The file is too large.');
    const ok = await confirm(
      `Replace all your data with ${path.basename(file)}?`,
      'Your current sessions, history, challenges and settings are replaced. A backup of them is kept and can be restored from Settings → Data.',
      'Replace',
    );
    if (!ok) return { status: 'cancelled' as const };
    const { counts } = importData(db, fs.readFileSync(file, 'utf8'), dirs);
    log.info('Imported data', counts);
    return { status: 'done' as const, counts };
  });

  handle('data:backupNow', () => {
    const file = backupDatabase(db, dirs.backups, 'manual', Date.now());
    log.info('Manual backup created');
    return listBackups(dirs.backups).find((b) => b.name === path.basename(file))!;
  });

  handle('data:listBackups', () => listBackups(dirs.backups));

  handle('data:restoreBackup', async (name) => {
    const backup = listBackups(dirs.backups).find((b) => b.name === name);
    if (!backup) throw new Error('That backup does not exist.');
    const ok = await confirm(
      `Restore the backup from ${new Date(backup.createdAt).toLocaleString()}?`,
      'Your current data is replaced by the backup. A backup of the current data is kept first.',
      'Restore',
    );
    if (!ok) return { status: 'cancelled' as const };
    const { counts } = restoreBackup(db, name, dirs);
    log.info('Restored backup', name);
    return { status: 'done' as const, counts };
  });
}
