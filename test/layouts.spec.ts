import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, type Page, _electron as electron } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { ElectronAPI } from '../electron/ipc/contract';

/** The timer's status word (Focus, Break, Paused, Ready), matched case-insensitively. */
const timerStatus = (page: Page, text: string) =>
  page.getByTestId('timer-status').filter({ hasText: new RegExp(`^${text}$`, 'i') });

const root = path.join(__dirname, '..');
let app: ElectronApplication;
let page: Page;
let userDataDir: string;

type BridgeWindow = Window & { electronAPI: ElectronAPI };

/** Picks a layout in Settings → Appearance and saves. */
async function switchLayout(option: RegExp) {
  await page.keyboard.press('Control+s');
  await page.getByRole('tab', { name: /appearance/i }).click();
  await page
    .getByRole('combobox')
    .filter({ hasText: /Zen Minimal|Dashboard -|Command Center -/ })
    .click();
  await page.getByRole('option', { name: option }).click();
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });
}

const start = () =>
  page
    .getByRole('button', { name: /^Start (\d+m )?focus$/i })
    .first()
    .click();

/** Statuses of today's plans, as stored. */
const planStatuses = () =>
  page.evaluate(async () => {
    const today = new Date().toISOString().split('T')[0];
    const plans = await (window as unknown as BridgeWindow).electronAPI.db.plans.getByDate(today);
    return plans.map((p) => p.status);
  });

beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-layouts-'));
  app = await electron.launch({
    args: [path.join(root, 'dist-electron', 'main', 'index.js'), '--no-sandbox'],
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', FOCUS_USER_DATA_DIR: userDataDir },
  });
  page = await app.firstWindow();
  await timerStatus(page, 'Ready').waitFor({ timeout: 20000 });
}, 60000);

afterAll(async () => {
  await app?.close();
  fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
});

describe('layouts', () => {
  test('Dashboard runs a session, and tools switch without dropping it', async () => {
    await switchLayout(/^Dashboard/);
    await page.getByRole('button', { name: 'Stopwatch' }).waitFor({ timeout: 10000 });

    await start();
    await timerStatus(page, 'Focus').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await timerStatus(page, 'Focus').waitFor({ timeout: 10000 });

    // Away to the stopwatch and back: the session kept running
    await page.getByRole('button', { name: 'Stopwatch' }).click();
    await page.getByRole('button', { name: /^start$/i }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Focus' }).click();
    await timerStatus(page, 'Focus').waitFor({ timeout: 10000 });

    // While running, the focus view shows its controls on hover
    await timerStatus(page, 'Focus').hover();
    await page.getByRole('button', { name: 'Stop session' }).first().click();
    await timerStatus(page, 'Ready').waitFor({ timeout: 10000 });
    expect(await planStatuses()).toEqual(['abandoned']);
  }, 60000);

  test('Command Center runs a session and shows its plan', async () => {
    await switchLayout(/^Command Center/);
    await page.getByText('Session Plan').waitFor({ timeout: 10000 });

    await start();
    await page.getByText('25m focus', { exact: true }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.getByRole('button', { name: 'Pause' }).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: 'Stop' }).click();
    await page.getByText('Start a session to see your plan').waitFor({ timeout: 10000 });
    expect(await planStatuses()).toEqual(['abandoned', 'abandoned']);
  }, 60000);

  test('switching layout mid-session keeps the session running', async () => {
    await start();
    await page.getByText('25m focus', { exact: true }).waitFor({ timeout: 10000 });

    await switchLayout(/^Zen Minimal/);
    // The Zen view picks up the same running session
    await timerStatus(page, 'Focus').waitFor({ timeout: 10000 });
    expect(await planStatuses()).toEqual(['abandoned', 'abandoned', 'active']);

    await timerStatus(page, 'Focus').hover();
    await page.getByRole('button', { name: 'Stop session' }).first().click();
    await timerStatus(page, 'Ready').waitFor({ timeout: 10000 });
  }, 60000);
});
