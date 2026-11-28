import React, { useState, useEffect, useRef } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { CommandCenterLayout } from './components/layout/CommandCenterLayout';
import { ZenFocusTimer } from './components/timer/ZenFocusTimer';
import { ZenCountdownTimer } from './components/timer/ZenCountdownTimer';
import { ZenStopwatch } from './components/timer/ZenStopwatch';
import { HistoryView } from './components/history/HistoryView';
import { FocusSettings } from './components/settings/FocusSettings';
import { AppSettings, DEFAULT_SETTINGS, SessionPlan } from './features/timer/types';
import { services } from '@/services/domain';
import { notificationService } from './services/notificationService';
import { useRecovery } from './features/timer/hooks/useRecovery';
import { RecoveryBanner } from './components/timer/RecoveryBanner';
import { useFocusTimerContext } from './features/timer/FocusTimerContext';
import { isTimerSpace } from './features/timer/isTimerSpace';
import { reportProblem } from './services/reportProblem';
import './App.css';
import { createLogger } from '@/services/logger';

const log = createLogger('App');

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState(0);
  const [theme, setTheme] = useState(createTheme());
  const { recoveryInfo, dismiss: dismissRecovery, resume: resumeRecovery } = useRecovery();
  const timer = useFocusTimerContext();

  // Latest values for the listeners registered once on mount
  const latest = useRef({ settings, currentTool, historyOpen });
  latest.current = { settings, currentTool, historyOpen };

  // The next session's length follows the setting until the user picks a preset
  const { phase, setPlannedMinutes } = timer;
  useEffect(() => {
    if (phase === 'idle') setPlannedMinutes(settings.focusDuration);
    // Only when the setting changes, not on every phase change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focusDuration]);

  const resumeInterruptedPlan = (plan: SessionPlan) => {
    timer.actions.resumePlan(plan);
    setCurrentTool(0); // Switch to focus timer
  };

  const handleResume = () => {
    const plan = resumeRecovery();
    if (plan) resumeInterruptedPlan(plan);
  };

  // Resume an interrupted plan chosen from the History view.
  const handleResumePlan = (plan: SessionPlan) => {
    resumeInterruptedPlan(plan);
    setHistoryOpen(false);
  };

  /** Tray Start and the global shortcut: show the focus timer and start (or resume) it. */
  const startFromOutside = () => {
    setCurrentTool(0);
    timer.startOrResume(latest.current.settings);
  };

  useEffect(() => {
    initializeApp();
    document.addEventListener('keydown', handleKeyDown);
    const unsubscribeFromTray = subscribeToTray();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unsubscribeFromTray();
    };
    // Mount-only: one-time init and listener registration. The handlers use only state setters,
    // the stable timer callbacks, and `latest` for current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateTheme();
    // updateTheme reads only settings.theme / settings.uiTheme, which are the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.uiTheme]);

  const initializeApp = async () => {
    try {
      // Finalize any plans left `active` by an abrupt shutdown so they don't
      // linger as ghosts in history and remain resumable.
      await services.plans.reconcileOrphans();
      const appState = await services.settings.load();
      setSettings(appState.settings);
      notificationService.setSettings(appState.settings);

      if (appState.settings.enableSystemNotifications) {
        await notificationService.requestPermission();
      }
    } catch (error) {
      log.error('Failed to initialize app:', error);
    }
  };

  const updateTheme = () => {
    const isDarkMode =
      settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
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

    const newTheme = createTheme({
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
              borderColor: effectiveIsDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(99, 102, 241, 0.2)',
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

    setTheme(newTheme);
  };

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    notificationService.setSettings(newSettings);
  };

  /** Listens for tray menu actions; returns a function that stops listening. */
  const subscribeToTray = (): (() => void) => {
    const api = window.electronAPI;
    if (!api) return () => {};
    const unsubscribers = [
      api.onTrayStartSession(startFromOutside),
      api.onGlobalShortcutStartSession(startFromOutside),
      api.onTrayOpenSettings(() => setSettingsOpen(true)),
      api.onTrayOpenHistory(() => setHistoryOpen(true)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Registered once on mount: read state through `latest`, never directly (it would be stale).
    if (isTimerSpace(event, latest.current.currentTool, latest.current.historyOpen)) {
      event.preventDefault();
      timer.toggle(latest.current.settings);
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'escape':
        setSettingsOpen(false);
        setHistoryOpen(false);
        break;
      case 's':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setSettingsOpen(true);
        }
        break;
      case 'h':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setHistoryOpen(true);
        }
        break;
      case '1':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setCurrentTool(0); // Focus Sessions
        }
        break;
      case '2':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setCurrentTool(1); // Timer
        }
        break;
      case '3':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setCurrentTool(2); // Stopwatch
        }
        break;
      case '4':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setCurrentTool(3); // Challenges
        }
        break;
      default:
        break;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        {/* Recovery banner for interrupted sessions */}
        {recoveryInfo && (
          <RecoveryBanner
            recovery={recoveryInfo}
            onDismiss={dismissRecovery}
            onResume={handleResume}
          />
        )}

        {/* Render layout based on settings */}
        {settings.layout === 'commandCenter' && (
          <CommandCenterLayout
            settings={settings}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        )}

        {settings.layout === 'dashboard' && (
          <DashboardLayout
            settings={settings}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onReportProblem={reportProblem}
            initialTool={currentTool}
            onToolChange={setCurrentTool}
          />
        )}

        {settings.layout === 'zen' && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              p: 4,
            }}
          >
            {currentTool === 0 && (
              <ZenFocusTimer
                settings={settings}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenHistory={() => setHistoryOpen(true)}
              />
            )}
            {currentTool === 1 && <ZenCountdownTimer />}
            {currentTool === 2 && <ZenStopwatch />}
          </Box>
        )}

        {historyOpen && (
          <HistoryView
            settings={settings}
            onClose={() => setHistoryOpen(false)}
            onResumePlan={handleResumePlan}
          />
        )}

        <FocusSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;
