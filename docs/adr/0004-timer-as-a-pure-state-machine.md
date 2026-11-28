# 0004. The timer as a pure state machine

- **Status:** Accepted
- **Date:** 2026-11-28
- **Issues:** #45, #82, #50

## Context

The focus timer is the core of the product and had regressed several times. Its logic lived inside a
988-line component that mixed timing, plan bookkeeping, persistence and UI, with refs mirroring state
to dodge stale closures. A second, weaker copy lived in the Command Center layout (no plans, no
crash-recovery snapshots), pauses were counted as focus time, and the stopwatch drifted.

## Decision

- The timer is a pure function, `transition(state, event) → { state, effects }`
  (`src/features/timer/engine/focusMachine.ts`): `idle → running ⇄ paused → next segment | complete`,
  plus skip, stop, reset, resume-from-plan and snapshot. Every event carries `now`; persistence,
  notifications and stats are returned as effect data.
- Time is active milliseconds measured against the wall clock, never a fixed step per interval.
- One `FocusTimerProvider` above the whole app runs the machine and executes its effects. Every
  layout, the tray, global shortcuts and the keyboard drive that single instance.
- The countdown and stopwatch tools use small machines of the same shape on a shared pausable clock.

## Consequences

- The engine is tested exhaustively without React, at 100% line, function and branch coverage.
- Views contain no timing logic and cannot diverge; switching views never drops a running session.
- Behaviour fixes (pause accounting, exact segment switches, Command Center records) came for free.
- Side effects are data, so a new one (for example a webhook) means one new effect type and one
  handler in `runFocusEffect`.
