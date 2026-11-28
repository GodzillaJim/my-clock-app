# 0002. SQLite, owned by the main process

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issues:** #78, #38, #43

## Context

Session history, plans, challenges and settings must survive restarts and crashes, and be queried
by date range for the history views. The prototype mixed three stores: `localStorage`, JSON files
written through a renderer-controlled file IPC, and SQLite. The file IPC let the renderer read and
write any path on disk (#38), and SQLite silently fell back to `localStorage` in development because
the native module was built for the wrong ABI (#78).

## Decision

- All persistent data lives in one SQLite database (`better-sqlite3`) in the user-data folder.
- Only the main process opens the database. The renderer reaches it through named IPC channels (see
  [0003](0003-typed-validated-ipc-contract.md)); it has no file-system access.
- Schema changes go through numbered migrations; data older than 90 days is pruned by date.
- `better-sqlite3` 13 ships N-API prebuilds, so the same binary works in Node (tests) and Electron.
- `localStorage` remains only as the fallback when the renderer runs outside Electron (tests, a
  plain browser).

## Consequences

- One source of truth with transactions, indexes and real queries.
- Repositories are testable against an in-memory database (`test/repositories.test.ts`).
- Every data access is an async IPC round trip; the renderer cannot read data synchronously.
- Removing the remaining `localStorage` fallback path is tracked in #43.

## Update (2026-11-28, #43)

The `localStorage` fallback is gone. The renderer's store is one interface, `FocusDb`
(`src/services/db.ts`): the SQLite bridge in Electron, and an in-memory implementation with the same semantics for unit tests or a renderer running outside Electron, where nothing is persisted.
