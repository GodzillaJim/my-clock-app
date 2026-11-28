import { createTheme, type Theme } from '@mui/material/styles';
import type { AppSettings } from '@/features/timer/types';
import { blur, colorScheme, motion, radius, typography, type ColorScheme } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    /** The active colour scheme's semantic tokens (see tokens.ts). */
    tokens: ColorScheme;
  }
  interface ThemeOptions {
    tokens?: ColorScheme;
  }
}

const transition = `all ${motion.base} ${motion.easeInOut}`;

/**
 * The MUI theme for a visual style (`deepFocus` or `aerogel`) and colour mode
 * (light, dark, or following the system's `prefersDark`), generated from the
 * design tokens.
 */
export function buildAppTheme(
  settings: Pick<AppSettings, 'theme' | 'uiTheme'>,
  prefersDark: boolean,
): Theme {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
  const s = colorScheme(settings.uiTheme || 'deepFocus', dark);

  return createTheme({
    tokens: s,
    palette: {
      mode: s.mode,
      background: { default: s.surface.page, paper: s.surface.card },
      primary: s.primary,
      secondary: s.secondary,
      text: { primary: s.text.primary, secondary: s.text.secondary },
      divider: s.line.divider,
      success: { main: s.success },
      error: { main: s.error },
      warning: { main: s.warning },
    },
    typography: {
      fontFamily: typography.fontFamily,
      ...typography.scale,
      button: { ...typography.scale.button, textTransform: 'none' },
      caption: { ...typography.scale.caption, color: s.text.secondary },
    },
    shape: { borderRadius: radius.md },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: radius.md,
            fontWeight: 500,
            boxShadow: 'none',
            transition,
          },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          outlined: s.outlinedButton
            ? {
                borderColor: s.outlinedButton.border,
                '&:hover': {
                  borderColor: s.outlinedButton.hoverBorder,
                  backgroundColor: s.outlinedButton.hoverFill,
                },
              }
            : {},
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: s.surface.paper,
            backdropFilter: blur.panel,
            border: `1px solid ${s.line.default}`,
            boxShadow: s.shadow.card,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            transition,
            '&:hover': { backgroundColor: s.overlay.hover },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: radius.sm, fontWeight: 500 } } },
      MuiTextField: {
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { '&:focus-visible': { outline: 'none' } } },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&:focus-visible': { outline: 'none' },
            '& input:focus-visible': { outline: 'none' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: s.primary.main },
          },
          notchedOutline: { borderColor: s.line.strong },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { '&:focus-visible': { outline: 'none' } },
          input: { '&:focus-visible': { outline: 'none' } },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: s.overlay.track },
          bar: { backgroundColor: s.primary.main },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: s.surface.raised,
            backdropFilter: blur.raised,
            border: `1px solid ${s.line.raised}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: s.surface.raised,
            backdropFilter: blur.raised,
            borderLeft: `1px solid ${s.line.default}`,
          },
        },
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: s.primary.main } } },
      MuiTab: { styleOverrides: { root: { '&.Mui-selected': { color: s.primary.main } } } },
    },
  });
}
