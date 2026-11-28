# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issue:** #51

## Context

The repository was brought from a template-derived prototype to a maintained product over milestones
M0–M2. Many of the resulting choices (where data lives, how the processes talk, how the timer works)
are not obvious from the code alone, and the reasons behind them are easy to lose.

## Decision

Keep architecture decision records in `docs/adr/`, one short Markdown file per decision, using
[template.md](template.md). ADRs are immutable once accepted; a changed decision gets a new ADR that
supersedes the old one.

## Consequences

- Reviewers and future contributors can see why the architecture is the way it is.
- A decision issue (such as #48 or #49) is closed by its ADR, with follow-up work filed as issues.
