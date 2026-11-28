import { createTheme, type Theme } from '@mui/material/styles';
import type { AppSettings } from '@/features/timer/types';

/**
 * The MUI theme for a visual style (`deepFocus` or `aerogel`) and colour
 * mode (light, dark, or following the system's `prefersDark`).
 */
export function buildAppTheme(
  settings: Pick<AppSettings, 'theme' | 'uiTheme'>,
  prefersDark: boolean,
): Theme {
  const isDarkMode = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
  const uiTheme = settings.uiTheme || 'deepFocus';

  // Deep Focus Theme - Clean dark, high-contrast
  const deepFocusPalette = {
    background: {
      default: '#0A0A0C', // Near black
      paper: 'rgba(24, 24, 28, 0.9)', // Dark surface
    },
    primary: {
      main: '#60A5FA', // Soft blue
      dark: '#3B82F6',
      light: '#93C5FD',
      contrastText: '#000000',
    },
    secondary: {
      main: '#A78BFA', // Soft purple
      dark: '#8B5CF6',
      light: '#C4B5FD',
      contrastText: '#000000',
    },
    text: {
      primary: '#F4F4F5',
      secondary: '#A1A1AA',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    success: { main: '#4ADE80' },
    error: { main: '#F87171' },
    warning: { main: '#FBBF24' },
  };

  // Aerogel Theme - Light, airy, glassmorphism with soft pastels
  const aerogelPalette = {
    background: {
      default: '#F8FAFC', // Soft white-blue
      paper: 'rgba(255, 255, 255, 0.7)', // Frosted glass
    },
    primary: {
      main: '#6366F1', // Soft indigo
      dark: '#4F46E5',
      light: '#818CF8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#EC4899', // Soft pink
      dark: '#DB2777',
      light: '#F472B6',
      contrastText: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    divider: 'rgba(99, 102, 241, 0.15)',
    success: { main: '#10B981' },
    error: { main: '#EF4444' },
    warning: { main: '#F59E0B' },
  };

  // Choose palette based on uiTheme and dark mode
  let activePalette;
  let effectiveIsDark = false;

  if (uiTheme === 'deepFocus') {
    // Deep Focus is always dark mode
    activePalette = deepFocusPalette;
    effectiveIsDark = true;
  } else {
    // Aerogel respects light/dark setting
    if (isDarkMode) {
      // Aerogel dark variant
      activePalette = {
        ...aerogelPalette,
        background: {
          default: '#0F172A',
          paper: 'rgba(30, 41, 59, 0.8)',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
        },
        divider: 'rgba(99, 102, 241, 0.2)',
      };
      effectiveIsDark = true;
    } else {
      activePalette = aerogelPalette;
      effectiveIsDark = false;
    }
  }

  const isDeepFocus = uiTheme === 'deepFocus';

  return createTheme({
    palette: {
      mode: effectiveIsDark ? 'dark' : 'light',
      ...activePalette,
    },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      h1: {
        fontSize: '4rem',
        fontWeight: 300,
        lineHeight: 1.1,
        letterSpacing: '-0.025em',
      },
      h2: {
        fontSize: '2.5rem',
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
      },
      h3: {
        fontSize: '1.875rem',
        fontWeight: 500,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: '1.125rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      button: {
        fontSize: '0.875rem',
        fontWeight: 500,
        textTransform: 'none' as const,
        letterSpacing: '0.01em',
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        color: activePalette.text.secondary,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 500,
            boxShadow: 'none',
            transition: 'all 0.2s ease-in-out',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: effectiveIsDark ? 'rgba(255, 255, 255, 0.2)' : undefined,
            '&:hover': {
              borderColor: effectiveIsDark ? 'rgba(255, 255, 255, 0.4)' : undefined,
              backgroundColor: effectiveIsDark ? 'rgba(255, 255, 255, 0.05)' : undefined,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDeepFocus
              ? 'rgba(24, 24, 28, 0.95)'
              : effectiveIsDark
                ? 'rgba(30, 41, 59, 0.8)'
                : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(12px)',
            border: effectiveIsDark
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(99, 102, 241, 0.1)',
            boxShadow: effectiveIsDark
              ? '0 4px 24px rgba(0, 0, 0, 0.4)'
              : '0 4px 24px rgba(0, 0, 0, 0.08)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: effectiveIsDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(99, 102, 241, 0.1)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '&:focus-visible': {
                outline: 'none',
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: 'none',
            },
            '& input:focus-visible': {
              outline: 'none',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: isDeepFocus ? '#60A5FA' : '#6366F1',
            },
          },
          notchedOutline: {
            borderColor: effectiveIsDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(99, 102, 241, 0.2)',
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: 'none',
            },
          },
          input: {
            '&:focus-visible': {
              outline: 'none',
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            backgroundColor: effectiveIsDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(99, 102, 241, 0.1)',
          },
          bar: {
            backgroundColor: isDeepFocus ? '#60A5FA' : '#6366F1',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDeepFocus
              ? 'rgba(18, 18, 22, 0.98)'
              : effectiveIsDark
                ? 'rgba(15, 23, 42, 0.95)'
                : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: effectiveIsDark
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(99, 102, 241, 0.15)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDeepFocus
              ? 'rgba(18, 18, 22, 0.98)'
              : effectiveIsDark
                ? 'rgba(15, 23, 42, 0.98)'
                : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderLeft: effectiveIsDark
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(99, 102, 241, 0.1)',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: isDeepFocus ? '#60A5FA' : '#6366F1',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              color: isDeepFocus ? '#60A5FA' : '#6366F1',
            },
          },
        },
      },
    },
  });
}
