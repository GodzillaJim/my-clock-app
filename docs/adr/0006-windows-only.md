# 0006. Windows only

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issues:** #21, #65, #68

## Context

Electron can target Windows, macOS and Linux, but every platform adds packaging, signing, native
integration (tray, notifications, shortcuts) and testing work. The project is a portfolio piece built
and tested on Windows.

## Decision

Ship for Windows (x64) only: an NSIS installer and a portable build from `electron-builder`. Native
integration targets Windows features (toast notifications with the alarm scenario, taskbar flashing,
the tray).

## Consequences

- One platform to polish, package and verify; `npm run build` and `npm run dist` build for Windows.
- macOS-specific code paths that remain from the template are untested.
- Code signing (#68) and auto-update (#67) only need a Windows story.
- Supporting another platform later means a new ADR, a packaging target and a test matrix.
