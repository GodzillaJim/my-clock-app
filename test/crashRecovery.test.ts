import { describe, expect, it } from 'vitest';
import {
  crashAction,
  MAX_RELOADS,
  RELOAD_WINDOW_MS,
  recordReload,
} from '../electron/main/crashRecovery';

const NOW = 1_000_000;

describe('renderer crash recovery', () => {
  it('ignores a clean exit', () => {
    expect(crashAction('clean-exit', [], NOW)).toBe('ignore');
  });

  it('reloads after a crash', () => {
    for (const reason of ['crashed', 'oom', 'killed', 'abnormal-exit', 'launch-failed']) {
      expect(crashAction(reason, [], NOW)).toBe('reload');
    }
  });

  it('asks the user once crashes repeat within the window', () => {
    const recent = Array.from({ length: MAX_RELOADS }, (_, i) => NOW - 1000 * (i + 1));
    expect(crashAction('crashed', recent, NOW)).toBe('ask');
  });

  it('forgets reloads older than the window', () => {
    const old = Array.from({ length: MAX_RELOADS }, () => NOW - RELOAD_WINDOW_MS - 1);
    expect(crashAction('crashed', old, NOW)).toBe('reload');
    expect(recordReload(old, NOW)).toEqual([NOW]);
    expect(recordReload([NOW - 10], NOW)).toEqual([NOW - 10, NOW]);
  });
});
