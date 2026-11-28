# 0008. Local checks instead of hosted CI

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issues:** #12, #13

## Context

The usual setup runs checks on a hosted CI service for every push. This project has a single
maintainer working on Windows, and its end-to-end tests drive a real Electron window, which needs a
Windows desktop session to be meaningful.

## Decision

- No hosted CI. `npm run check` is the gate before every merge: typecheck, lint, format, knip, unit
  tests with a coverage ratchet, e2e tests against a test build, and a production build.
- Git hooks catch problems earlier: lint-staged formats and lints staged files, and commitlint
  enforces Conventional Commits.
- The README documents how to run the checks.

## Consequences

- No CI minutes, secrets or runner maintenance; the checks run where the app actually runs.
- Discipline replaces enforcement: a merge without `npm run check` is possible. Every PR states
  that the checks passed.
- The coverage ratchet (`thresholds.autoUpdate`) only moves up, so coverage cannot silently drop.
