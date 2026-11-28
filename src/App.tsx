import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { buildAppTheme } from './theme/buildAppTheme';
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

  // Follows the system colour scheme live when the theme setting is "system"
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(
    () => buildAppTheme({ theme: settings.theme, uiTheme: settings.uiTheme }, prefersDark),
    [settings.theme, settings.uiTheme, prefersDark],
  );

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
