# 0005. Keep three layouts on one timer engine

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issue:** #48

## Context

The app offers three layouts: _Zen_ (a centred timer), _Dashboard_ (sidebar with tools and a stats
panel) and _Command Center_ (timer, session plan, recent sessions and today's stats on one screen).
Each is separate UI to design, test and maintain. Options considered: ship one polished layout,
keep Zen and Dashboard, or keep all three.

The cost of keeping them dropped with [0004](0004-timer-as-a-pure-state-machine.md): all layouts are
now views on one timer engine, so they cannot diverge in behaviour, only in presentation.

## Decision

Keep all three layouts. They serve different ways of working (minimal, tool-oriented, overview), and
the shared engine keeps their maintenance cost to presentation code.

## Consequences

- M4's design work (#58, #59) and accessibility pass (#63) cover all three layouts.
- In Zen, the countdown and stopwatch are reachable only by keyboard shortcut; this needs a visible
  tool switcher (#99).
- The e2e suite exercises only the Zen layout; Dashboard and Command Center need coverage (#100).
