/**
 * The sentences History is written in. Numbers are told as short plain-language
 * summaries rather than shown as big figures (PRODUCT.md: progress is
 * acknowledged, not scored). Kept pure so the wording is tested directly.
 */
import { formatTime } from '@/features/timer/types';

type TimeFormat = '12h' | '24h';

/** Differences under this are "about the same". */
const NOTICEABLE_SECONDS = 5 * 60;

/** "2 h 5 min", "45 min", "1 h", "under a minute". */
export function formatSpan(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A stored "HH:MM" clock time in the user's 12h/24h format; "" when there is none ("--:--"). */
export function clockLabel(hhmm: string, format: TimeFormat): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return '';
  const d = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return formatTime(d, format);
}

/** The opening line: today against the user's own usual day, and the current run of days. */
export function todaySummary(
  todaySeconds: number,
  averageSeconds: number,
  streakDays: number,
): string {
  const usual = averageSeconds > 0 ? formatSpan(averageSeconds) : null;
  let text: string;
  if (todaySeconds <= 0) {
    text = usual
      ? `Nothing yet today. A usual day for you is about ${usual}.`
      : 'Nothing yet today.';
  } else {
    const today = `You've focused for ${formatSpan(todaySeconds)} today`;
    const delta = todaySeconds - averageSeconds;
    if (!usual) text = `${today}.`;
    else if (delta >= NOTICEABLE_SECONDS) text = `${today}, more than your usual ${usual}.`;
    else if (delta <= -NOTICEABLE_SECONDS)
      text = `${today}. A usual day for you is about ${usual}.`;
    else text = `${today}, right around your usual ${usual}.`;
  }
  if (streakDays >= 2) text += ` That's ${streakDays} days in a row.`;
  return text;
}

/** This week's daily average against the month's. Never scolds. */
export function paceSummary(last7Average: number, last30Average: number): string {
  const delta = last7Average - last30Average;
  if (last30Average <= 0) return 'Your monthly pace shows here after a few days of focus.';
  if (delta >= NOTICEABLE_SECONDS) return 'This week is running ahead of your monthly pace.';
  if (delta <= -NOTICEABLE_SECONDS) return 'This week has been quieter than your monthly pace.';
  return 'This week is in step with your monthly pace.';
}

export interface DayFacts {
  focusSeconds: number;
  focusSessions: number;
  firstStart: number | null;
  lastEnd: number | null;
}

/** "2 h 5 min of focus in 3 sessions, from 1:46 PM to 4:06 PM." */
export function daySummary(day: DayFacts, format: TimeFormat): string {
  if (day.focusSessions === 0) return 'No focus sessions on this day.';
  const sessions = `${day.focusSessions} ${day.focusSessions === 1 ? 'session' : 'sessions'}`;
  let text = `${formatSpan(day.focusSeconds)} of focus in ${sessions}`;
  if (day.firstStart != null && day.lastEnd != null) {
    text += `, from ${formatTime(new Date(day.firstStart), format)} to ${formatTime(new Date(day.lastEnd), format)}`;
  }
  return `${text}.`;
}
