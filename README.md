# Focus Sessions

A Windows desktop focus timer. Pick how long you want to work; Focus Sessions splits it into focus and
break segments, runs them back to back, survives crashes mid-session, and keeps 90 days of history so you
can see when and how well you focus.

Built with Electron, React and TypeScript, with all data stored locally in SQLite.

> **Status:** in active development toward v1.0. See the [roadmap](ROADMAP.md) for what's planned and
> what's in progress. There are no installers yet — build from source (below).

## Features

**Focus runs**

- Choose a total length (quick presets, configurable) and start; the run is split into focus and break
  segments using your focus/break durations
- Pause, resume, skip to the next segment, or stop; the timer shows when the current segment and the whole
  run will end
- Synthesized notification sounds with in-settings preview, optional tick during the last 10 seconds,
  and Windows system notifications

**Crash recovery**

- The active run is snapshotted every 5 seconds; if the app or PC goes down mid-session, the next launch
  offers to **Resume** the remaining segments or **Dismiss** the run, which is kept in history as interrupted

**History and insights**

- A plain-language summary of today, a 12-week focus heatmap (arrow keys move between days), a
  timeline of any day, and your 30-day rhythm
- Streaks, average day start/end times and focus totals, computed from your local history
- Sessions, plans and daily history are kept for 90 days

**More tools**

- Countdown timer and stopwatch
- Challenges: multi-day goals tracked on a calendar
- Export and import all data, back up on demand, and restore any backup (Settings → Data)
- _Report a problem_ (settings or sidebar) opens a pre-filled GitHub issue and shows the log file to attach

**Look and feel**

- Three layouts: _Zen_ (centered timer), _Dashboard_ (sidebar + stats), _Command Center_ (all-in-one with timeline)
- One calm style in light and dark: warm neutrals, a terracotta accent for focus and sage for
  breaks. It follows the Windows theme unless you pick one
- Lives in the system tray, whose _Start Focus Session_ item starts (or resumes) the timer
- Global shortcuts, from any app: **Ctrl+Shift+Alt+T** brings the window to the front,
  **Ctrl+Shift+Alt+S** starts (or resumes) a focus session
- In-app shortcuts: **Space** starts, pauses and resumes the focus timer, **Ctrl+1–4** switch tool,
  **Ctrl+S** settings, **Ctrl+H** history, **Esc** closes dialogs
- Switching tools or layouts never interrupts a running session

**Known gaps** (tracked on the roadmap): no auto-update or signed installer yet (milestone M5).

## Getting started

**Prerequisites:** Windows 10 or later, Node.js 22 (see `.nvmrc`) and npm.

```bash
git clone https://github.com/GodzillaJim/my-clock-app.git
cd my-clock-app
npm ci          # installs locked dependencies and rebuilds better-sqlite3 for Electron
npm run dev     # starts Vite and launches the app with hot reload
```

Your data lives in a `focus-sessions.db` SQLite file in the app's folder under `%APPDATA%`. Before a schema upgrade, the app saves a copy to `backups\` in the same folder (the last 5 are kept).
Logs from both processes go to `logs\main.log` in the same folder (rotated to `main.old.log`
at 5 MB). App code logs through `createLogger(scope)` from `src/services/logger.ts` (renderer)
or `electron/main/logger.ts` (main); `console.*` is a lint error.

### Build an installer

```bash
npm run dist    # NSIS installer + portable .exe in release/<version>/
```

## Checks

There is no hosted CI: checks run locally. **Run `npm run check` before every push** — it must pass
before a PR is merged.

```bash
npm run check       # everything below, in order; stops at the first failure

npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (typescript-eslint, react-hooks, jsx-a11y), zero warnings allowed
npm run format:check # Prettier; `npm run format` fixes
npm run knip        # no unused files, dependencies or exports
npm test            # test:unit, then test:e2e
  npm run test:unit #   unit tests (jsdom) with coverage, a few seconds, no build needed
  npm run test:e2e  #   builds in test mode, then drives the real Electron app with Playwright
npx vite build      # production build
```

**Coverage** is measured on unit tests (report in `coverage/index.html`). Thresholds in
`vitest.config.ts` ratchet: the run fails if coverage drops, and they're raised automatically when it
improves — commit the bumped numbers with your change.

The first unit run after installing or upgrading dependencies can fail with an "outdated
optimized dependency" error while Vitest re-bundles React/MUI; just run it again.

**Before a release**, also run `npm run perf`: it builds the production app and fails if startup
JavaScript, cold start or idle memory exceed the budgets in [docs/performance.md](docs/performance.md).

The e2e suite launches the real Electron app against a throwaway profile in your temp directory; it
never touches your own Focus Sessions data, and works while the app is open.

A **pre-commit hook** (installed by `npm ci`) runs ESLint `--fix` and Prettier on staged files, so
formatting and lint issues are caught before they reach a commit. Bypass in an emergency with
`git commit --no-verify`. For `git blame`, run once:
`git config blame.ignoreRevsFile .git-blame-ignore-revs` to skip formatting-only commits.

## Scripts

| Command                   | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`             | Run the app in development with hot reload                                                  |
| `npm run check`           | Typecheck, lint, format check, knip, all tests and production build — run before every push |
| `npm run typecheck`       | TypeScript type check                                                                       |
| `npm run lint`            | ESLint with zero warnings allowed                                                           |
| `npm run format`          | Format everything with Prettier (`format:check` only checks)                                |
| `npm run knip`            | Find unused files, dependencies and exports                                                 |
| `npm test`                | Unit tests, then e2e tests                                                                  |
| `npm run test:unit`       | Unit tests only (jsdom) — fast, no build                                                    |
| `npm run test:e2e`        | Build in test mode, then e2e tests against the real Electron app                            |
| `npm run build`           | Typecheck, build and package for Windows                                                    |
| `npm run dist`            | Same as `build`, never publishes                                                            |
| `npm run preview`         | Preview the renderer build in a browser                                                     |
| `npm run release:version` | Bump version, update CHANGELOG.md and tag from Conventional Commits                         |

## Project structure

```
electron/
  main/
    index.ts          # app lifecycle, window, tray, global shortcuts
    ipc.ts            # typed, schema-validated ipcMain.handle (ipcSchemas.ts: zod schemas)
    security.ts, csp.ts, logger.ts
    database/         # SQLite connection, migrations, repositories, IPC handlers, retention
  ipc/contract.ts     # IPC contract: every channel's arguments and result, and window.electronAPI
  preload/index.ts    # contextBridge API built from the contract (sandboxed)
src/
  components/
    timer/            # focus timer, countdown, stopwatch, recovery banner
    layout/           # Dashboard and Command Center layouts, sidebar, stats panel
    history/          # history view: timeline, heatmap, trends
    challenges/       # challenges view, calendar, create dialog
    settings/         # settings dialog
  features/timer/     # timer engine (pure state machines in engine/), React hooks, domain types
  features/stats/     # pure statistics: day summaries, streaks, lifetime stats
  theme/              # design tokens (tokens.ts) and the MUI theme generated from them
  services/domain/    # domain services (settings, sessions, plans, history, stats, challenges)
  services/           # data store (db.ts), notifications, sounds, crash-recovery snapshot
  __tests__/          # unit tests (Vitest + Testing Library)
test/                 # e2e tests (Playwright driving Electron) and main-process unit tests
```

## Tech stack

Electron 45 · React 19 · TypeScript (strict) · MUI 9 · Vite 8 · better-sqlite3 · Vitest + Testing Library ·
Playwright (Electron e2e) · knip · electron-builder (NSIS)

## Security

The renderer is sandboxed with a strict CSP and reaches the main process only through a typed, schema-validated IPC contract. See [docs/security.md](docs/security.md) for the Electron checklist review, findings and accepted risks.

The reasoning behind the architecture (SQLite in the main process, the IPC contract, the timer state machine, layouts, Windows-only, local checks) is recorded in [docs/adr](docs/adr/README.md).

## Contributing

1. Pick an issue from the [roadmap](ROADMAP.md) (`priority:high` first within a milestone)
2. Branch from `main`, make the change, and add or update tests
3. Run `npm run check` — it must pass
4. Use [Conventional Commits](https://www.conventionalcommits.org) (`feat: …`, `fix: …`) — the
   `commit-msg` hook enforces it — and give the PR a conventional title (squash merges use it)
5. Open a PR that says `Closes #N` and ticks the matching box in `ROADMAP.md`

## License

[MIT](LICENSE)
