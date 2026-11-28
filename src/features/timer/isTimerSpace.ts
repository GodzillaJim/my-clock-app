/**
 * Space starts, pauses and resumes the focus timer, but only on the focus view,
 * with no dialog or history open, and never when a control has focus: there,
 * Space must keep activating the focused button, checkbox, tab, ...
 */
export function isTimerSpace(
  event: KeyboardEvent,
  currentTool: number,
  historyOpen: boolean,
): boolean {
  if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey || event.repeat)
    return false;
  if (currentTool !== 0 || historyOpen || document.querySelector('[role="dialog"]')) return false;
  const target = event.target;
  const interactive =
    'button, a[href], input, textarea, select, [contenteditable="true"], [role="button"], [role="tab"], [role="slider"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"]';
  return !(target instanceof Element && target.closest(interactive));
}
