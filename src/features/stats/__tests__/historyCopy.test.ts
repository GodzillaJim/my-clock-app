import { describe, expect, it } from 'vitest';
import { clockLabel, daySummary, formatSpan, paceSummary, todaySummary } from '../historyCopy';

const MIN = 60;
const H = 3600;

describe('formatSpan', () => {
  it.each([
    [0, 'under a minute'],
    [29, 'under a minute'],
    [45 * MIN, '45 min'],
    [H, '1 h'],
    [2 * H + 5 * MIN, '2 h 5 min'],
  ])('%i s → %s', (seconds, text) => {
    expect(formatSpan(seconds)).toBe(text);
  });
});

describe('clockLabel', () => {
  it('shows a stored clock time in the chosen format', () => {
    expect(clockLabel('09:03', '12h')).toBe('9:03 AM');
    expect(clockLabel('14:30', '24h')).toBe('14:30');
  });

  it('is empty when there is no time yet', () => {
    expect(clockLabel('', '12h')).toBe('');
    expect(clockLabel('--:--', '12h')).toBe('');
  });
});

describe('todaySummary', () => {
  it('compares today with the usual day, kindly', () => {
    expect(todaySummary(2 * H + 5 * MIN, H, 0)).toBe(
      "You've focused for 2 h 5 min today, more than your usual 1 h.",
    );
    expect(todaySummary(20 * MIN, H, 0)).toBe(
      "You've focused for 20 min today. A usual day for you is about 1 h.",
    );
    expect(todaySummary(H + 2 * MIN, H, 0)).toBe(
      "You've focused for 1 h 2 min today, right around your usual 1 h.",
    );
  });

  it('works before there is a usual day or any focus today', () => {
    expect(todaySummary(25 * MIN, 0, 0)).toBe("You've focused for 25 min today.");
    expect(todaySummary(0, 0, 0)).toBe('Nothing yet today.');
    expect(todaySummary(0, H, 0)).toBe('Nothing yet today. A usual day for you is about 1 h.');
  });

  it('mentions a run of two days or more', () => {
    expect(todaySummary(25 * MIN, 0, 1)).toBe("You've focused for 25 min today.");
    expect(todaySummary(25 * MIN, 0, 6)).toBe(
      "You've focused for 25 min today. That's 6 days in a row.",
    );
  });
});

describe('paceSummary', () => {
  it('describes this week against the month', () => {
    expect(paceSummary(2 * H, H)).toMatch(/ahead/);
    expect(paceSummary(30 * MIN, H)).toMatch(/quieter/);
    expect(paceSummary(H + MIN, H)).toMatch(/in step/);
    expect(paceSummary(0, 0)).toMatch(/after a few days/);
  });
});

describe('daySummary', () => {
  it('sums up a day in one sentence', () => {
    const start = new Date(2026, 0, 1, 13, 46).getTime();
    const end = new Date(2026, 0, 1, 16, 6).getTime();
    expect(
      daySummary(
        { focusSeconds: 2 * H + 5 * MIN, focusSessions: 3, firstStart: start, lastEnd: end },
        '12h',
      ),
    ).toBe('2 h 5 min of focus in 3 sessions, from 1:46 PM to 4:06 PM.');
    expect(
      daySummary(
        { focusSeconds: 25 * MIN, focusSessions: 1, firstStart: null, lastEnd: null },
        '24h',
      ),
    ).toBe('25 min of focus in 1 session.');
    expect(
      daySummary({ focusSeconds: 0, focusSessions: 0, firstStart: null, lastEnd: null }, '12h'),
    ).toBe('No focus sessions on this day.');
  });
});
