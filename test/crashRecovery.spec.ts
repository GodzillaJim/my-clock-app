import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, type Page, _electron as electron } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { ElectronAPI } from '../electron/ipc/contract';

const root = path.join(__dirname, '..');
const mainEntry = path.join(root, 'dist-electron', 'main', 'index.js');
let userDataDir: string;
let app: ElectronApplication | null = null;

type BridgeWindow = Window & { electronAPI: ElectronAPI };

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', FOCUS_USER_DATA_DIR: userDataDir },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

/** Kills a process and all its children immediately. */
function killTree(pid: number) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(-pid, 'SIGKILL');
  }
}

/** Seconds shown on the focus timer, e.g. "24:53" → 1493. */
async function clockSeconds(page: Page): Promise<number> {
  const text = await page
    .getByText(/^\d{2}:\d{2}$/)
    .first()
    .innerText();
  const [m, s] = text.split(':').map(Number);
  return m * 60 + s;
}

beforeAll(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-crash-'));
});

afterAll(async () => {
  await app?.close().catch(() => {});
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('crash recovery', () => {
  test('a session killed mid-run is offered on relaunch and resumes where it stopped', async () => {
    // 1. Start a 25-minute focus session and let it run past a snapshot (every 5 s)
    let { app: running, page } = await launch();
    await page.getByRole('button', { name: /^Start 25m Focus$/ }).click();
    await page.getByText('FOCUS', { exact: true }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(7000);

    // 2. Crash: kill the whole process tree at once (no quit handlers, no clean shutdown),
    //    as a crash or power loss would, so nothing is left holding the profile
    const exited = new Promise<void>((resolve) => running.process().once('exit', () => resolve()));
    killTree(running.process().pid!);
    await exited;
    app = null;

    // 3. Relaunch on the same profile: the interrupted session is offered
    ({ app: running, page } = await launch());
    await page.getByText('Session Interrupted').waitFor({ timeout: 15000 });
    const banner = page.getByRole('alert').filter({ hasText: 'Session Interrupted' });
    await expect(banner.innerText()).resolves.toMatch(/0\/1 segments/);
    await expect(banner.innerText()).resolves.toMatch(/1 segments \(\d+m\) remained/);

    // 4. Resume continues with the time that was left, not a fresh 25 minutes
    await banner.getByRole('button', { name: 'Resume' }).click();
    await page.getByText('FOCUS', { exact: true }).waitFor({ timeout: 10000 });
    await banner.waitFor({ state: 'hidden', timeout: 10000 });
    const remaining = await clockSeconds(page);
    expect(remaining).toBeLessThan(25 * 60 - 4);
    expect(remaining).toBeGreaterThan(24 * 60);

    // 5. Storage agrees: the old plan is retired with its elapsed time kept,
    //    and a new plan carries the remaining work
    const plans = await page.evaluate(async () => {
      const today = new Date().toISOString().split('T')[0];
      const all = await (window as unknown as BridgeWindow).electronAPI.db.plans.getByDate(today);
      return all.map((p) => ({
        status: p.status,
        planned: p.totalPlannedDuration,
        firstSegment: { status: p.segments[0].status, actual: p.segments[0].actualDuration },
      }));
    });
    const old = plans.find((p) => p.planned === 25 * 60)!;
    const resumed = plans.find((p) => p.status === 'active')!;
    expect(old.status).toBe('interrupted');
    expect(old.firstSegment.status).toBe('skipped');
    expect(old.firstSegment.actual).toBeGreaterThanOrEqual(4);
    expect(resumed.planned).toBeLessThan(25 * 60);

    // 6. A clean stop leaves nothing to recover on the next launch
    await page.getByRole('button', { name: 'Stop session' }).first().click();
    await page.getByText('READY', { exact: true }).waitFor({ timeout: 10000 });
    await running.close();
    ({ app: running, page } = await launch());
    await page.getByText('READY', { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    expect(await page.getByText('Session Interrupted').count()).toBe(0);
  }, 90_000);
});
