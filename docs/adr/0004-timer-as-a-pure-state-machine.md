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

## Update (2026-11-28, #56): sleep and clock changes

- **Sleep pauses the session.** The main process forwards `powerMonitor`'s `suspend` with its timestamp; the machine pauses at that moment, even if the renderer only processes it after waking. As a fallback for any freeze (hibernate, a suspended VM), a gap of more than 30 s between ticks pauses the session as of the last tick. Time asleep never counts as focus, a segment never "completes" because of it, and a notification says the session was paused.
- **The window is never throttled** (`backgroundThrottling: false`), so ticks keep arriving every 250 ms in the tray and segment ends are not delayed by Chromium's background timer throttling.
- **Clock jumps.** A backwards jump of more than 2 s shifts the running span by the same amount, so the countdown neither stalls nor repeats. Smaller jitter is ignored. A forward jump under 30 s counts as elapsed time; a larger one is indistinguishable from sleep and pauses.
