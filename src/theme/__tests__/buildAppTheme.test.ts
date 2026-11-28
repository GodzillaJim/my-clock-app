import { describe, expect, it } from 'vitest';
import { buildAppTheme } from '../buildAppTheme';
import { colorScheme } from '../tokens';

describe('buildAppTheme', () => {
  it('follows the light and dark setting', () => {
    expect(buildAppTheme({ theme: 'light' }, true).palette.mode).toBe('light');
    expect(buildAppTheme({ theme: 'dark' }, false).palette.mode).toBe('dark');
  });

  it('"system" follows the operating system preference', () => {
    expect(buildAppTheme({ theme: 'system' }, true).palette.mode).toBe('dark');
    expect(buildAppTheme({ theme: 'system' }, false).palette.mode).toBe('light');
  });

  it('takes its palette and tokens from the scheme', () => {
    for (const dark of [false, true]) {
      const theme = buildAppTheme({ theme: dark ? 'dark' : 'light' }, false);
      const scheme = colorScheme(dark);
      expect(theme.tokens).toStrictEqual(scheme);
      expect(theme.palette.primary.main).toBe(scheme.primary.main);
      expect(theme.palette.secondary.main).toBe(scheme.secondary.main);
      expect(theme.palette.background.default).toBe(scheme.surface.page);
    }
  });
});
