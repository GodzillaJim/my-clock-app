import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, type Page, _electron as electron } from 'playwright';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';

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

    test('runs the renderer with web security enabled', async () => {
      const webSecurity = await electronApp.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()?.webSecurity,
      );
      expect(webSecurity).toBe(true);
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

    test('gives the renderer no file-system access', async () => {
      // Outside the app data directory: the old storage IPC accepted any path
      const target = path.join(os.tmpdir(), `focus-e2e-escape-${Date.now()}.txt`);
      const result = await page.evaluate(async (target) => {
        const w = window as any;
        const attempts = await Promise.allSettled([
          w.ipcRenderer.invoke('storage-write', target, 'written by the renderer'),
          w.ipcRenderer.invoke('storage-read', target),
          w.ipcRenderer.invoke('storage-delete', target),
          w.ipcRenderer.invoke('get-storage-path', '../../escape'),
          w.ipcRenderer.invoke('get-user-data-path'),
        ]);
        return {
          fileApis: Object.keys(w.electronAPI).filter((k) => /storage|path/i.test(k)),
          statuses: attempts.map((a) => a.status),
        };
      }, target);
      expect(result.fileApis).toEqual([]);
      expect(result.statuses).toEqual(Array(5).fill('rejected'));
      expect(fs.existsSync(target)).toBe(false);
    });

    test('initializes the SQLite database', async () => {
      // Fails if better-sqlite3 was not rebuilt for Electron's ABI — the app
      // would otherwise fall back to localStorage silently.
      expect(fs.existsSync(path.join(userDataDir, 'focus-sessions.db'))).toBe(true);
    });

    test('writes main and renderer logs to the log file', async () => {
      const logFile = path.join(userDataDir, 'logs', 'main.log');
      await page.evaluate(() =>
        (window as any).electronAPI.log('warn', 'e2e', ['renderer log probe', { n: 1 }]),
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
        const w = window as any;
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

    test('retains every session from the last 90 days and prunes older ones', async () => {
      const result = await page.evaluate(async () => {
        const sessions = (window as any).electronAPI.db.sessions;
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
  });
}
