// Performance budget check: `npm run perf` (run before releases).
// Builds the production app, then measures the renderer bundle, cold start to
// the first usable screen, and idle memory. Exits non-zero when a budget is
// exceeded. Budgets and how to read the numbers: docs/performance.md.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Keep in sync with docs/performance.md (baseline 2026-11-28: 150 KB, 260 KB, ~770 ms, 206 MB). */
const BUDGETS = {
  entryJsGzipKb: 180,
  totalJsGzipKb: 300,
  coldStartMs: 1500,
  idleMemoryMb: 260,
};
const STARTUP_RUNS = 3;
const IDLE_SETTLE_MS = 5000;

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function measureBundle() {
  const dist = path.join(root, 'dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const entry = html.match(/<script[^>]+src="\.?\/?([^"]+\.js)"/)?.[1];
  if (!entry) throw new Error('No entry script in dist/index.html');
  const gzip = (file) => zlib.gzipSync(fs.readFileSync(path.join(dist, file))).length;
  const chunks = fs
    .readdirSync(path.join(dist, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => `assets/${f}`);
  return {
    entryJsGzipKb: kb(gzip(entry)),
    entryJsRawKb: kb(fs.statSync(path.join(dist, entry)).size),
    totalJsGzipKb: kb(chunks.reduce((sum, f) => sum + gzip(f), 0)),
    chunks: chunks.length,
  };
}

async function launchOnce() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-perf-'));
  const started = performance.now();
  const app = await electron.launch({
    args: [path.join(root, 'dist-electron', 'main', 'index.js')],
    cwd: root,
    env: { ...process.env, FOCUS_USER_DATA_DIR: userData },
  });
  const page = await app.firstWindow();
  await page.getByText('READY', { exact: true }).waitFor({ timeout: 30000 });
  const startMs = Math.round(performance.now() - started);
  return { app, startMs, userData };
}

async function measureRuntime() {
  const starts = [];
  let idleMemoryMb = 0;
  for (let run = 1; run <= STARTUP_RUNS; run++) {
    const { app, startMs, userData } = await launchOnce();
    starts.push(startMs);
    if (run === STARTUP_RUNS) {
      await new Promise((r) => setTimeout(r, IDLE_SETTLE_MS));
      const metrics = await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics());
      // Private memory (KB) summed across main, renderer, GPU and utility processes, as
      // Task Manager shows it. Working sets would count pages they share several times.
      idleMemoryMb = Math.round(
        metrics.reduce((sum, m) => sum + (m.memory.privateBytes ?? m.memory.workingSetSize), 0) /
          1024,
      );
    }
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
  return { coldStartMs: median(starts), coldStartRunsMs: starts, idleMemoryMb };
}

if (!process.argv.includes('--no-build')) {
  console.log('Building the production app…');
  execSync('npx vite build', { cwd: root, stdio: 'ignore' });
}

const bundle = measureBundle();
const runtime = await measureRuntime();
const results = { ...bundle, ...runtime };

const rows = Object.entries(BUDGETS).map(([key, budget]) => ({
  metric: key,
  value: results[key],
  budget,
  ok: results[key] <= budget,
}));
console.log('');
for (const r of rows) {
  console.log(
    `${r.ok ? 'ok  ' : 'OVER'}  ${r.metric.padEnd(16)} ${String(r.value).padStart(8)}  (budget ${r.budget})`,
  );
}
console.log(
  `\n      entry chunk ${bundle.entryJsRawKb} KB raw · ${bundle.chunks} chunks · starts ${runtime.coldStartRunsMs.join(', ')} ms`,
);
if (rows.some((r) => !r.ok)) {
  console.error('\nPerformance budget exceeded.');
  process.exit(1);
}
