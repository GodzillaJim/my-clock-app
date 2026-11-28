/**
 * Decides how to recover when the renderer process dies. Reloading usually
 * brings the app back (the crash-recovery banner then offers the interrupted
 * session), but a renderer that keeps crashing must not reload forever.
 */

/** Allow this many automatic reloads... */
export const MAX_RELOADS = 3;
/** ...within this window. */
export const RELOAD_WINDOW_MS = 60_000;

export type CrashAction = 'ignore' | 'reload' | 'ask';

/**
 * @param reason `details.reason` from `render-process-gone`
 * @param recentReloads timestamps of earlier automatic reloads
 */
export function crashAction(reason: string, recentReloads: number[], now: number): CrashAction {
  // A normal exit (e.g. the window closing) is not a crash
  if (reason === 'clean-exit') return 'ignore';
  const inWindow = recentReloads.filter((t) => now - t < RELOAD_WINDOW_MS);
  return inWindow.length < MAX_RELOADS ? 'reload' : 'ask';
}

/** Reload timestamps still inside the window, plus `now`. */
export function recordReload(recentReloads: number[], now: number): number[] {
  return [...recentReloads.filter((t) => now - t < RELOAD_WINDOW_MS), now];
}
