# 0003. A typed, schema-validated IPC contract

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issues:** #40, #41, #44, #37, #42

## Context

The renderer is the least trusted part of an Electron app: any script that runs there (an XSS bug, a
compromised dependency) can call whatever the preload exposes. The template exposed a generic
`window.ipcRenderer` for any channel, channel names and payload types were duplicated by hand in three
places, and handlers wrote renderer payloads straight to SQLite as `any`. One handler built SQL column
names from renderer-supplied keys.

## Decision

- `electron/ipc/contract.ts` defines every channel: its argument tuple, its result, and the
  `window.electronAPI` shape. Main handlers, the preload and the renderer all derive their types
  from it, so a payload change fails compilation on every side.
- Main registers handlers through `handle()`, which first checks that the sender is the app's own
  top-level page and then validates the arguments with that channel's zod schema
  (`electron/main/ipcSchemas.ts`). Unknown keys are stripped and sizes are bounded.
- The preload exposes only named functions from the contract, from a sandboxed renderer. There is
  no raw IPC access.

## Consequences

- Adding a channel takes three small, compiler-checked steps: contract, schema, handler.
- Invalid or untrusted calls are rejected and logged before reaching any repository.
- `any` is gone from the codebase and is now a lint error.
- Schemas duplicate the domain types in runtime form; they are typed against the contract, so the
  two cannot drift silently.
- See [docs/security.md](../security.md) for the full review.
