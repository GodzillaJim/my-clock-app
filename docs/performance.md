# Performance budget

`npm run perf` builds the production app and checks it against these budgets. It exits non-zero
when one is exceeded. Run it before every release; it is not part of `npm run check` because
startup time and memory depend on the machine and what else it is doing.

| Metric                    | Budget  | Baseline (2026-11-28) | How it is measured                                                                       |
| ------------------------- | ------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Startup JavaScript (gzip) | 180 KB  | 150 KB                | The entry chunk referenced by `dist/index.html`, gzipped                                 |
| All JavaScript (gzip)     | 300 KB  | 260 KB                | Every chunk in `dist/assets`, gzipped                                                    |
| Cold start                | 1500 ms | ~770 ms               | Launch to the Zen timer showing **READY**, fresh profile each time; median of 3 launches |
| Idle memory               | 260 MB  | 206 MB                | Private memory of all app processes after 5 s idle (what Task Manager shows)             |

Baselines were measured on the development machine (Windows 11). The budgets leave room for
normal variation; a run over budget is a regression to investigate, not noise to tolerate.

## Why these numbers

- **Startup JavaScript** is what the renderer must download, parse and run before the first
  screen. Views most launches never open (History, Settings, Challenges, the Dashboard and Command
  Center layouts, and the date picker they use) are loaded on first use with `React.lazy`, which
  cut it from 251 KB to 150 KB.
- **Memory** counts private bytes. Summing working sets would count pages that Chromium's
  processes share several times (that sum is about 600 MB for the same app).

## When a budget fails

1. Re-run once: a busy machine can slow a single start.
2. Compare the bundle numbers with the previous release. A jump in startup JavaScript usually
   means a heavy import reached the initial view; load it lazily or import a narrower module.
3. If an increase is intended, raise the budget here and in `scripts/perf.mjs` in the same change,
   with the reason in the commit message.
