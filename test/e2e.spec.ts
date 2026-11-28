import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, type Page, _electron as electron } from 'playwright';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import type { ElectronAPI } from '../electron/ipc/contract';

/** The page's window as tests probe it: the bridge plus arbitrary globals. */
type ProbeWindow = Window & Record<string, unknown> & { electronAPI: ElectronAPI };

const root = path.join(__dirname, '..');
const screenshotDir = path.join(root, 'test', 'screenshots');
let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;

if (process.platform === 'linux') {
  // pass ubuntu
  test(() => expect(true).true);
} else {
  beforeAll(async () => {
    const mainEntry = path.join(root, 'dist-electron', 'main', 'index.js');

    // Run against a throwaway profile so tests never touch the real database
    // and don't collide with the single-instance lock of a running app.
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-e2e-'));

    electronApp = await electron.launch({
      args: [mainEntry, '--no-sandbox'],
      cwd: root,
      env: { ...process.env, NODE_ENV: 'test', FOCUS_USER_DATA_DIR: userDataDir },
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  }, 60000);

  afterAll(async () => {
    if (page) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, 'e2e.png') }).catch(() => {});
    }
    if (electronApp) {
      await electronApp.close();
    }
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  describe('[Focus Sessions] e2e tests', async () => {
    test('startup', async () => {
      const title = await page.title();
      expect(title).eq('Focus Sessions - Ready to Focus');
    });

    test('uses an isolated user-data directory', async () => {
      const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'));
      expect(path.resolve(userData)).toBe(path.resolve(userDataDir));
    });

    test('runs the renderer sandboxed, isolated and with web security', async () => {
      const prefs = await electronApp.evaluate(({ BrowserWindow }) => {
        const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
          sandbox: p?.sandbox,
          contextIsolation: p?.contextIsolation,
          nodeIntegration: p?.nodeIntegration,
          webSecurity: p?.webSecurity,
          // Not echoed by getLastWebPreferences; read the live setting
          backgroundThrottling:
            BrowserWindow.getAllWindows()[0].webContents.getBackgroundThrottling(),
        };
      });
      expect(prefs).toEqual({
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false,
      });
      expect(page.url()).toBe('app://bundle/index.html');
    });

    test('refuses app:// requests that escape the renderer folder', async () => {
      const statuses = await page.evaluate(async () => {
        const probe = async (p: string) => (await fetch(`app://bundle${p}`)).status;
        return {
          index: await probe('/index.html'),
          traversal: await probe('/..%2F..%2Fpackage.json'),
        };
      });
      expect(statuses).toEqual({ index: 200, traversal: 404 });
    });

    test('exposes only the named bridge API, without raw IPC or Node', async () => {
      const surface = await page.evaluate(() => {
        const w = window as unknown as ProbeWindow;
        return {
          ipcRenderer: typeof w.ipcRenderer,
          require: typeof w.require,
          process: typeof w.process,
          api: Object.keys(w.electronAPI).sort(),
        };
      });
      expect(surface).toEqual({
        ipcRenderer: 'undefined',
        require: 'undefined',
        process: 'undefined',
        api: [
          'data',
          'db',
          'log',
          'minimizeToTray',
          'onGlobalShortcutStartSession',
          'onSystemSuspend',
          'onTrayOpenHistory',
          'onTrayOpenSettings',
          'onTrayStartSession',
          'reportProblem',
          'sessionNotification',
          'showWindow',
          'updateTrayStatus',
        ],
      });
    });

    test('has no file-system storage handlers in the main process', async () => {
      // The old storage-* channels accepted any absolute path from the renderer.
      // Registering a handler throws if one already exists for that channel.
      const registered = await electronApp.evaluate(({ ipcMain }) =>
        ['storage-read', 'storage-write', 'storage-delete', 'get-storage-path'].filter((ch) => {
          try {
            ipcMain.handle(ch, () => null);
            ipcMain.removeHandler(ch);
            return false;
          } catch {
            return true;
          }
        }),
      );
      expect(registered).toEqual([]);
    });
    test('initializes the SQLite database', async () => {
      // Fails if better-sqlite3 was not rebuilt for Electron's ABI — the app
      // would otherwise fall back to localStorage silently.
      expect(fs.existsSync(path.join(userDataDir, 'focus-sessions.db'))).toBe(true);
    });

    test('writes main and renderer logs to the log file', async () => {
      const logFile = path.join(userDataDir, 'logs', 'main.log');
      await page.evaluate(() =>
        (window as unknown as ProbeWindow).electronAPI.log('warn', 'e2e', [
          'renderer log probe',
          { n: 1 },
        ]),
      );
      const deadline = Date.now() + 5000;
      let contents = '';
      while (Date.now() < deadline) {
        contents = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
        if (contents.includes('renderer log probe')) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(contents).toContain('Focus Sessions');
      expect(contents).toContain('SQLite database initialized');
      expect(contents).toMatch(/\[warn\]\s*\(renderer:e2e\)\s*renderer log probe/);
    });

    test('enforces the Content Security Policy without breaking the app', async () => {
      const logFile = path.join(userDataDir, 'logs', 'main.log');
      // The app itself (React, Emotion styles, the preload's loader) must not trip the policy
      expect(fs.readFileSync(logFile, 'utf8')).not.toContain('CSP violation');

      // (eval can't be probed from here: DevTools evaluation is exempt from CSP)
      const probes = await page.evaluate(async () => {
        const w = window as unknown as ProbeWindow;
        const script = document.createElement('script');
        script.textContent = 'window.__cspInlineProbe = true';
        document.head.appendChild(script);
        const res = await fetch('app://bundle/index.html');
        return {
          inlineRan: w.__cspInlineProbe === true,
          header: res.headers.get('content-security-policy') ?? '',
        };
      });
      expect(probes.inlineRan).toBe(false);
      expect(probes.header).toContain("script-src 'self';");
      expect(probes.header).not.toContain('unsafe-eval');

      // The blocked inline script is reported to the log file
      const deadline = Date.now() + 5000;
      let contents = '';
      while (Date.now() < deadline && !contents.includes('CSP violation')) {
        await new Promise((r) => setTimeout(r, 100));
        contents = fs.readFileSync(logFile, 'utf8');
      }
      expect(contents).toMatch(/CSP violation:\s*script-src/);
    });

    test('renders the idle focus timer', async () => {
      await page.getByText('READY', { exact: true }).waitFor({ timeout: 15000 });

      const startButton = page.getByRole('button', { name: /^Start \d+m Focus$/ }).first();
      await startButton.waitFor({ state: 'visible', timeout: 15000 });
      expect(await startButton.isEnabled()).toBe(true);
    });

    test('starts a focus session and stops it again', async () => {
      await page
        .getByRole('button', { name: /^Start \d+m Focus$/ })
        .first()
        .click();

      await page.getByText('FOCUS', { exact: true }).waitFor({ timeout: 10000 });

      // Stop so the run doesn't leave an active plan behind
      await page.getByRole('button', { name: 'Stop session' }).first().click();
      await page.getByText('READY', { exact: true }).waitFor({ timeout: 10000 });
    }, 30000);

    test('tray Start, the global shortcut and Space control the timer', async () => {
      const send = (channel: string) =>
        electronApp.evaluate(
          ({ BrowserWindow }, ch) => BrowserWindow.getAllWindows()[0].webContents.send(ch),
          channel,
        );
      const label = (text: string) => page.getByText(text, { exact: true });

      // Tray "Start Focus Session" starts a session
      await send('tray-start-session');
      await label('FOCUS').waitFor({ timeout: 10000 });

      // Space (with nothing focused) pauses and resumes it
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: 'Resume' }).waitFor({ timeout: 10000 });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Space');
      await label('FOCUS').waitFor({ timeout: 10000 });

      // Switching tools does not drop the running session
      await page.keyboard.press('Control+3');
      await page.getByRole('button', { name: /^start$/i }).waitFor({ timeout: 10000 });
      await page.keyboard.press('Control+1');
      await label('FOCUS').waitFor({ timeout: 10000 });

      // The global shortcut resumes a paused session
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: 'Resume' }).waitFor({ timeout: 10000 });
      await send('global-shortcut-start-session');
      await label('FOCUS').waitFor({ timeout: 10000 });

      await page.getByRole('button', { name: 'Stop session' }).first().click();
      await label('READY').waitFor({ timeout: 10000 });
    }, 30000);
    test('Report a problem opens a pre-filled issue and reveals the log', async () => {
      // Stub the shell in main so the test never opens a real browser or Explorer
      const stubbed = await electronApp.evaluate(({ shell }) => {
        const g = globalThis as unknown as { __shellCalls: string[][] };
        g.__shellCalls = [];
        const open = async (url: string) => {
          g.__shellCalls.push(['open', url]);
        };
        const reveal = (p: string) => {
          g.__shellCalls.push(['reveal', p]);
        };
        try {
          Object.assign(shell, { openExternal: open, showItemInFolder: reveal });
        } catch {
          return false;
        }
        return shell.openExternal === open && shell.showItemInFolder === reveal;
      });
      expect(stubbed).toBe(true);

      await page.evaluate(() => (window as unknown as ProbeWindow).electronAPI.reportProblem());
      const calls = await electronApp.evaluate(
        () => (globalThis as unknown as { __shellCalls: string[][] }).__shellCalls,
      );

      const reveal = calls.find(([kind]) => kind === 'reveal')!;
      expect(path.resolve(reveal[1])).toBe(path.resolve(userDataDir, 'logs', 'main.log'));
      const url = new URL(calls.find(([kind]) => kind === 'open')![1]);
      expect(url.href).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new\?/);
      expect(url.searchParams.get('body')).toMatch(/Focus Sessions \d+\.\d+\.\d+ · Electron/);
    });
    test('pauses a running session when the system goes to sleep', async () => {
      await page
        .getByRole('button', { name: /^Start \d+m Focus$/ })
        .first()
        .click();
      await page.getByText('FOCUS', { exact: true }).waitFor({ timeout: 10000 });

      // What Windows sends just before sleeping, through the real main-process handler
      await electronApp.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'));
      await page.getByRole('button', { name: 'Resume' }).waitFor({ timeout: 10000 });
      const log = fs.readFileSync(path.join(userDataDir, 'logs', 'main.log'), 'utf8');
      expect(log).toContain('System suspending');

      await page.getByRole('button', { name: 'Stop session' }).first().click();
      await page.getByText('READY', { exact: true }).waitFor({ timeout: 10000 });
    }, 30000);
    test('exports, backs up, imports and restores all data from Settings → Data', async () => {
      const exportFile = path.join(userDataDir, 'export-e2e.json');
      // Stub the native dialogs in main: save/open pick exportFile, confirmations say yes
      const stubbed = await electronApp.evaluate(({ dialog }, file) => {
        const stubs = {
          showSaveDialog: async () => ({ canceled: false, filePath: file }),
          showOpenDialog: async () => ({ canceled: false, filePaths: [file] }),
          showMessageBox: async () => ({ response: 0, checkboxChecked: false }),
        };
        Object.assign(dialog, stubs);
        return dialog.showSaveDialog === stubs.showSaveDialog;
      }, exportFile);
      expect(stubbed).toBe(true);

      const sessionIds = () =>
        page.evaluate(async () =>
          (await (window as unknown as ProbeWindow).electronAPI.db.sessions.getHistory())
            .map((s) => s.id)
            .sort(),
        );
      const openDataTab = async () => {
        await page.keyboard.press('Control+s');
        await page.getByRole('tab', { name: /data/i }).click();
      };
      const before = await sessionIds();
      expect(before.length).toBeGreaterThan(0);

      // Export
      await openDataTab();
      await page.getByRole('button', { name: 'Export data…' }).click();
      await page.getByText('Exported to export-e2e.json.').waitFor({ timeout: 10000 });
      const exported = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
      expect(exported.format).toBe('focus-sessions-export');
      expect(exported.tables.sessions).toHaveLength(before.length);

      // Back up now
      await page.getByRole('button', { name: 'Back up now' }).click();
      await page.getByText('Backup created.').waitFor({ timeout: 10000 });
      await page.getByText(/Manual backup/).waitFor({ timeout: 10000 });

      // Change the data, then import the export: the app reloads with the exported data
      await page.evaluate(async (id) => {
        await (window as unknown as ProbeWindow).electronAPI.db.sessions.delete(id);
      }, before[0]);
      expect(await sessionIds()).toHaveLength(before.length - 1);
      await page.getByRole('button', { name: 'Import data…' }).click();
      await page.getByText('READY', { exact: true }).waitFor({ timeout: 15000 });
      expect(await sessionIds()).toEqual(before);

      // Restore the manual backup (also the full data set) from the list
      await page.evaluate(async (id) => {
        await (window as unknown as ProbeWindow).electronAPI.db.sessions.delete(id);
      }, before[0]);
      await openDataTab();
      await page.getByText(/Before an import/).waitFor({ timeout: 10000 });
      const manual = page.getByRole('listitem').filter({ hasText: 'Manual backup' });
      await manual.getByRole('button', { name: /Restore backup/ }).click();
      await page.getByText('READY', { exact: true }).waitFor({ timeout: 15000 });
      expect(await sessionIds()).toEqual(before);
    }, 60000);
    test('opens settings and history from the tray menu', async () => {
      const send = (channel: string) =>
        electronApp.evaluate(
          ({ BrowserWindow }, ch) => BrowserWindow.getAllWindows()[0].webContents.send(ch),
          channel,
        );

      await send('tray-open-settings');
      await page.getByText('Focus Sessions Settings').waitFor({ timeout: 10000 });
      await page.keyboard.press('Escape');
      await page.getByText('Focus Sessions Settings').waitFor({ state: 'hidden', timeout: 10000 });

      await send('tray-open-history');
      const back = page.getByRole('button', { name: 'Back' });
      await back.waitFor({ timeout: 10000 });
      await back.click();
      await back.waitFor({ state: 'hidden', timeout: 10000 });
    }, 30000);
    test('rejects malformed IPC calls in the main process', async () => {
      const errors = await page.evaluate(async () => {
        const db = (window as unknown as ProbeWindow).electronAPI.db as unknown as Record<
          string,
          Record<string, (...args: unknown[]) => Promise<unknown>>
        >;
        const attempt = (p: Promise<unknown>) =>
          p.then(
            () => 'resolved',
            (e: Error) => e.message,
          );
        return [
          await attempt(db.sessions.getByDate('../../etc')),
          await attempt(db.kv.get('secrets')),
          await attempt(db.sessions.save({ id: 'x', type: 'FOCUS' })),
        ];
      });
      for (const message of errors) {
        expect(message).toContain('Invalid arguments for db:');
      }
      const log = fs.readFileSync(path.join(userDataDir, 'logs', 'main.log'), 'utf8');
      expect(log).toMatch(/\(ipc\)\s*Invalid arguments for db:sessions:getByDate/);
    });
    test('refuses IPC from pages other than the app', async () => {
      // Another origin that somehow got the preload must not reach the handlers
      const preload = path.join(root, 'dist-electron', 'preload', 'index.cjs');
      const result = await electronApp.evaluate(async ({ BrowserWindow }, preloadPath) => {
        const intruder = new BrowserWindow({
          show: false,
          webPreferences: { preload: preloadPath, sandbox: true, contextIsolation: true },
        });
        try {
          await intruder.loadURL('data:text/html,<p>intruder</p>');
          return await intruder.webContents.executeJavaScript(
            `window.electronAPI.db.kv.get('app_state').then(() => 'resolved', (e) => e.message)`,
          );
        } finally {
          intruder.destroy();
        }
      }, preload);
      expect(result).toContain('Untrusted sender for db:kv:get');
      const log = fs.readFileSync(path.join(userDataDir, 'logs', 'main.log'), 'utf8');
      expect(log).toMatch(/Rejected IPC from untrusted sender:\s*data:text\/html/);
    });
    test('retains every session from the last 90 days and prunes older ones', async () => {
      const result = await page.evaluate(async () => {
        const sessions = (window as unknown as ProbeWindow).electronAPI.db.sessions;
        const DAY = 24 * 60 * 60 * 1000;
        const make = (id: string, start: number) => ({
          id,
          type: 'focus',
          sessionNumber: 1,
          plannedDuration: 60,
          actualDuration: 60,
          startTime: new Date(start),
          endTime: new Date(start + 60_000),
          pausedTime: 0,
          completionStatus: 'completed',
          remainingTime: 0,
        });
        await sessions.save(make('retention-old', Date.now() - 100 * DAY));
        // More than the old 1000-row cap, all within the retention window
        for (let i = 0; i < 1005; i++) {
          await sessions.save(make(`retention-recent-${i}`, Date.now() - i * 60_000));
        }
        const all: { id: string }[] = await sessions.getHistory();
        return {
          recent: all.filter((s) => s.id.startsWith('retention-recent-')).length,
          hasOld: all.some((s) => s.id === 'retention-old'),
        };
      });
      expect(result.recent).toBe(1005);
      expect(result.hasOld).toBe(false);
    }, 30000);

    // Runs last: it crashes and reloads the renderer
    test('reloads the window after the renderer crashes', async () => {
      await electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer(),
      );
      const logFile = path.join(userDataDir, 'logs', 'main.log');
      const deadline = Date.now() + 15000;
      let reloaded = false;
      while (Date.now() < deadline && !reloaded) {
        await new Promise((r) => setTimeout(r, 250));
        reloaded = await electronApp.evaluate(async ({ BrowserWindow }) => {
          const wc = BrowserWindow.getAllWindows()[0].webContents;
          if (wc.isCrashed() || wc.isLoading()) return false;
          return wc
            .executeJavaScript(`document.body.innerText.includes('READY')`)
            .catch(() => false);
        });
      }
      expect(reloaded).toBe(true);
      expect(fs.readFileSync(logFile, 'utf8')).toMatch(
        /Renderer process gone \((crashed|killed)[^)]*\); reload/,
      );
    }, 30000);
  });
}
