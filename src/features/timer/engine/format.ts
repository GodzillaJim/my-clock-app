/** `h:mm:ss`, or `mm:ss` under an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** "25 minutes of focus.", for the completion screen. */
export function focusSummary(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'Under a minute of focus.';
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} of focus.`;
}
