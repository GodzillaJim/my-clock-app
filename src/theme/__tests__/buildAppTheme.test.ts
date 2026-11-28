import { describe, expect, it } from 'vitest';
import { buildAppTheme } from '../buildAppTheme';

describe('buildAppTheme', () => {
  it('Deep Focus is always dark with its blue accent', () => {
    for (const mode of ['light', 'dark', 'system'] as const) {
      const theme = buildAppTheme({ theme: mode, uiTheme: 'deepFocus' }, false);
      expect(theme.palette.mode).toBe('dark');
      expect(theme.palette.primary.main).toBe('#60A5FA');
    }
  });

  it('Aerogel follows the light/dark setting', () => {
    expect(buildAppTheme({ theme: 'light', uiTheme: 'aerogel' }, true).palette.mode).toBe('light');
    expect(buildAppTheme({ theme: 'dark', uiTheme: 'aerogel' }, false).palette.mode).toBe('dark');
    expect(buildAppTheme({ theme: 'light', uiTheme: 'aerogel' }, false).palette.primary.main).toBe(
      '#6366F1',
    );
  });

  it('"system" follows the operating system preference', () => {
    expect(buildAppTheme({ theme: 'system', uiTheme: 'aerogel' }, true).palette.mode).toBe('dark');
    expect(buildAppTheme({ theme: 'system', uiTheme: 'aerogel' }, false).palette.mode).toBe(
      'light',
    );
  });
});
