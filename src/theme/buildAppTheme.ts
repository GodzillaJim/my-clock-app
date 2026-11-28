import { createTheme, type Theme } from '@mui/material/styles';
import type { AppSettings } from '@/features/timer/types';
import { colorScheme, motion, radius, typography, type ColorScheme } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    /** The active colour scheme's semantic tokens (see tokens.ts). */
    tokens: ColorScheme;
  }
  interface ThemeOptions {
    tokens?: ColorScheme;
  }
}

const transition = ['background-color', 'border-color', 'color', 'box-shadow', 'opacity']
  .map((p) => `${p} ${motion.fast} ${motion.easeOut}`)
  .join(', ');

/** Whether the theme setting resolves to dark, given the system's preference. */
export function isDarkTheme(theme: AppSettings['theme'], prefersDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && prefersDark);
}

/** The MUI theme for the light or dark scheme, generated from the design tokens. */
export function buildAppTheme(settings: Pick<AppSettings, 'theme'>, prefersDark: boolean): Theme {
  const s = colorScheme(isDarkTheme(settings.theme, prefersDark));

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
      action: { hover: s.overlay.hover },
    },
    typography: {
      fontFamily: typography.fontFamily,
      ...typography.scale,
      h1: { ...typography.scale.h1, fontFamily: typography.displayFamily },
      h2: { ...typography.scale.h2, fontFamily: typography.displayFamily },
      h3: { ...typography.scale.h3, fontFamily: typography.displayFamily },
      button: { ...typography.scale.button, textTransform: 'none' },
      caption: { ...typography.scale.caption, color: s.text.secondary },
    },
    shape: { borderRadius: radius.md },
    transitions: {
      easing: {
        easeOut: motion.easeOut,
        easeInOut: motion.easeOut,
        easeIn: motion.easeOut,
        sharp: motion.easeOut,
      },
    },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: radius.md,
            fontWeight: 600,
            transition,
          },
          // Primary actions are pills; text and outlined buttons stay quiet rectangles.
          contained: { borderRadius: radius.pill, paddingInline: 22 },
          outlined: {
            borderColor: s.outlinedButton.border,
            '&:hover': {
              borderColor: s.outlinedButton.hoverBorder,
              backgroundColor: s.outlinedButton.hoverFill,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: s.surface.paper,
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
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            color: s.text.secondary,
            borderColor: s.line.default,
            transition,
            '&:hover': { backgroundColor: s.overlay.hover },
            '&.Mui-selected': {
              color: s.text.primary,
              backgroundColor: s.surface.card,
              '&:hover': { backgroundColor: s.surface.card },
            },
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
          root: { backgroundColor: s.overlay.track, borderRadius: radius.pill },
          bar: { backgroundColor: s.primary.main, borderRadius: radius.pill },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: s.surface.raised,
            border: `1px solid ${s.line.raised}`,
            borderRadius: radius.lg,
            boxShadow: s.shadow.raised,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: s.surface.raised,
            border: 'none',
            borderLeft: `1px solid ${s.line.default}`,
            borderRadius: 0,
            boxShadow: s.shadow.raised,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: s.text.primary,
            color: s.surface.page,
            fontSize: typography.scale.caption.fontSize,
            fontWeight: 500,
            borderRadius: radius.sm,
          },
        },
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: s.primary.main } } },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-selected': { color: s.text.primary },
          },
        },
      },
    },
  });
}
