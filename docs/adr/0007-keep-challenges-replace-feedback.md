# 0007. Keep Challenges; replace Feedback with issue reports

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issue:** #49

## Context

Two secondary features carry about 2,000 lines:

- **Challenges** (~1,200 lines) tracks multi-day habit streaks, such as "focus every day for 30
  days". It fits a focus app and complements the session history.
- **Feedback** (~800 lines) is a form plus a manager that store bug reports and ideas in the local
  database. The app is offline and single-user, so nothing ever reaches the developer; the user is
  filing reports to themselves.

## Decision

- Keep Challenges and polish it in M4.
- Remove the Feedback feature. In its place, "Report a problem" opens a pre-filled GitHub issue in the
  browser and points the user at the log file to attach.

## Consequences

- About 800 lines, two IPC channels' worth of surface and a repository go away.
- Reports reach the developer, with the app version and logs that make them actionable.
- Existing feedback rows stay in the database untouched; no migration deletes user data.
- Follow-up: #101 (replace Feedback), #102 (polish Challenges).
