# Security review

**Scope:** the Electron main process, preload bridge, renderer and packaging configuration.
**Reviewed:** 2026-11-28, Electron 45, against the [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).
**Result:** all 20 checklist items pass. The remaining risks are low and accepted; they are listed at the end.

## Threat model

Focus Sessions is an offline, single-user desktop app. It loads no remote content and has no account or server. The realistic threats are:

1. **Script running in the renderer**, for example through an XSS bug in a dependency. The goal is that such a script can reach nothing beyond the app's own data, and only through validated calls.
2. **Tampering with the installed app**, for example by modifying `app.asar` or starting the binary as a plain Node runtime.
3. **Supply-chain issues** in npm dependencies.

A local attacker who already runs code as the same Windows user is out of scope. They can read the database directly.

## Architecture at a glance

```
renderer (sandboxed, contextIsolation, strict CSP, app://bundle)
   │  window.electronAPI: named functions only (electron/ipc/contract.ts)
   ▼
preload (sandboxed, CJS, no Node APIs beyond ipcRenderer)
   │  ipcRenderer.invoke / send on contract channels
   ▼
main: handle(): 1. sender is the app's top-level page?  2. zod schema for the arguments?
   │  parameterized SQL only
   ▼
SQLite (userData/focus-sessions.db)
```

## Electron checklist

| #   | Recommendation                               | Status | Where                                                                                                                                                                 |
| --- | -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Only load secure content                     | Pass   | Renderer served from the bundled `app://bundle` scheme; nothing loaded from the network (CSP `connect-src 'self'`)                                                    |
| 2   | No Node.js integration for remote content    | Pass   | `nodeIntegration: false` (`electron/main/index.ts`)                                                                                                                   |
| 3   | Context isolation                            | Pass   | `contextIsolation: true`                                                                                                                                              |
| 4   | Process sandboxing                           | Pass   | `sandbox: true`; preload is CJS and only requires `electron`                                                                                                          |
| 5   | Handle session permission requests           | Pass   | Every permission denied except `notifications` (`isAllowedPermission`)                                                                                                |
| 6   | Do not disable `webSecurity`                 | Pass   | `webSecurity: true`, asserted in e2e                                                                                                                                  |
| 7   | Content Security Policy                      | Pass   | Strict policy on every `app://` response (`electron/main/csp.ts`): no inline scripts, no `eval`. Violations are logged                                                |
| 8   | No `allowRunningInsecureContent`             | Pass   | Not set (default `false`)                                                                                                                                             |
| 9   | No experimental features                     | Pass   | Not set                                                                                                                                                               |
| 10  | No `enableBlinkFeatures`                     | Pass   | Not set                                                                                                                                                               |
| 11  | `<webview>`: no `allowpopups`                | Pass   | `webviewTag: false`; `will-attach-webview` is prevented for every webContents                                                                                         |
| 12  | Verify webview options before creation       | Pass   | No webviews can attach (see 11)                                                                                                                                       |
| 13  | Disable or limit navigation                  | Pass   | `will-navigate` allows only `app://bundle` (or the Vite dev server in development)                                                                                    |
| 14  | Disable or limit new windows                 | Pass   | `setWindowOpenHandler` denies every new window, for all webContents                                                                                                   |
| 15  | No `shell.openExternal` with untrusted input | Pass   | Only `https:` URLs from `window.open` are opened externally (`isExternalLink`)                                                                                        |
| 16  | Current Electron                             | Pass   | Electron 45                                                                                                                                                           |
| 17  | Validate the sender of IPC messages          | Pass   | `handle()` and the log channel accept only the app's own top-level frame (`isTrustedSender`); e2e tests that another page with the same preload is refused            |
| 18  | Avoid `file://`; prefer a custom protocol    | Pass   | Privileged `app://` scheme with path-traversal containment (`electron/main/appProtocol.ts`)                                                                           |
| 19  | Electron fuses                               | Pass   | Set in `electron-builder.json`: `RunAsNode`, `NODE_OPTIONS` and `--inspect` disabled; ASAR integrity validation and only-load-from-ASAR enabled; cookie encryption on |
| 20  | Do not expose Electron APIs to web content   | Pass   | No raw `ipcRenderer`; the bridge is the named, typed API from the IPC contract (asserted in e2e)                                                                      |

## Code review findings

| Finding                                                                                                                       | Severity | Status                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `storage-read/write/delete` IPC accepted any absolute path from the renderer: arbitrary file read, write and delete           | High     | Fixed in #91 (channels removed)                                        |
| Template exposed a generic `window.ipcRenderer` (any channel, any listener)                                                   | High     | Fixed in #93                                                           |
| `plans:updateSegment` built SQL column names from renderer-supplied object keys                                               | High     | Fixed in #94 (channel removed)                                         |
| Renderer payloads were written to SQLite unvalidated (`any`)                                                                  | Medium   | Fixed in #94 (zod schema per channel, unknown keys stripped)           |
| `app://` handler could serve files outside the renderer folder                                                                | Medium   | Fixed in #86 / #80                                                     |
| No CSP; `webSecurity: false`                                                                                                  | Medium   | Fixed in #86 and #92                                                   |
| IPC sender not validated                                                                                                      | Medium   | Fixed in this review                                                   |
| Fuses left at Electron defaults (`RunAsNode` on, `--inspect` allowed)                                                         | Medium   | Fixed in this review                                                   |
| Auto-updater template: unvalidated IPC handlers, `verifyUpdateCodeSignature: false`, no feed configured                       | Medium   | Removed in this review; #67 reintroduces updates with signature checks |
| All SQL statements use bound parameters (the one interpolated column name in `feedbackRepo.countBy` comes from a fixed union) | n/a      | Verified                                                               |
| Toast XML for notifications escapes title and body                                                                            | n/a      | Verified                                                               |

## Accepted risks

- **`style-src 'unsafe-inline'`.** Emotion (MUI) injects `<style>` tags at runtime. Scripts remain fully restricted.
- **The renderer can write to the log file.** Levels and scopes are validated, arguments are capped at 20, and the file rotates at 5 MB. The worst case is noisy or misleading log lines.
- **`FOCUS_USER_DATA_DIR` moves the profile.** It is used for isolated test runs. Anyone who can set the app's environment already runs code as the user.
- **Key-value documents (app state, lifetime stats) are checked only for being JSON objects.** They are stored as opaque JSON and never reach SQL.
- **Unsigned builds.** Windows SmartScreen warns on first run. Code signing is an open decision (#68).
- **Dev-only advisories.** `npm audit` reports 6 moderate issues in `minimatch` under electron-builder, which is a build-time tool only. The suggested fix downgrades electron-builder, so it is not applied. Production dependencies: 0 known vulnerabilities.

## Keeping it this way

- New IPC goes into `electron/ipc/contract.ts`, gets a schema in `electron/main/ipcSchemas.ts`, and is registered with `handle()`. The types make a missing schema a compile error.
- The e2e suite asserts the security-relevant state on every `npm run check`:
  - window preferences
  - the exact bridge surface
  - CSP enforcement
  - sender rejection
  - argument rejection
  - `app://` traversal
- To verify a packaged build's fuses:

  ```powershell
  npx @electron/fuses read --app "release/<version>/win-unpacked/Focus Sessions.exe"
  ```

- Re-run this review when adding remote content, auto-update (#67) or new native capabilities.
