import React, { useState, useEffect } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { FocusTimer } from './components/timer/FocusTimer';
import { SessionHistory } from './components/history/SessionHistory';
import { FocusSettings } from './components/settings/FocusSettings';
import { FeedbackForm } from './components/feedback/FeedbackForm';
import { FeedbackManager } from './components/feedback/FeedbackManager';
import { AppSettings, DEFAULT_SETTINGS } from './features/timer/types';
import { focusStorage } from './services/focusStorage';
import { notificationService } from './services/notificationService';
import "./App.css";

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackManagerOpen, setFeedbackManagerOpen] = useState(false);
  const [theme, setTheme] = useState(createTheme());

  useEffect(() => {
    initializeApp();
    setupKeyboardShortcuts();
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    updateTheme();
  }, [settings.theme]);

  const initializeApp = async () => {
    try {
      await focusStorage.initialize();
      const appState = await focusStorage.getAppState();
      setSettings(appState.settings);
      notificationService.setSettings(appState.settings);
      
      if (appState.settings.enableSystemNotifications) {
        await notificationService.requestPermission();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  const updateTheme = () => {
    const isDarkMode = settings.theme === 'dark' || 
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const newTheme = createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: {
          main: '#2196f3',
        },
        secondary: {
          main: '#ff9800',
        },
        success: {
          main: '#4caf50',
        },
        background: {
          default: isDarkMode ? '#121212' : '#fafafa',
          paper: isDarkMode ? '#1e1e1e' : '#ffffff',
        },
      },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
          fontWeight: 300,
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
              borderRadius: 8,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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

  const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', handleKeyDown);
    
    // Setup Electron IPC listeners for tray and global shortcuts
    if (window.electronAPI) {
      window.electronAPI.onTrayStartSession(() => {
        // This would trigger the start session functionality
        // We'll need to expose this through a ref or context
      });
      
      window.electronAPI.onTrayOpenSettings(() => {
        setSettingsOpen(true);
      });
      
      window.electronAPI.onTrayOpenHistory(() => {
        setHistoryOpen(true);
      });
      
      window.electronAPI.onGlobalShortcutStartSession(() => {
        // This would trigger the start session functionality
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case ' ':
        event.preventDefault();
        // Start/pause functionality would be handled by the timer component
        break;
      case 'escape':
        if (settingsOpen) {
          setSettingsOpen(false);
        } else if (historyOpen) {
          setHistoryOpen(false);
        } else if (feedbackOpen) {
          setFeedbackOpen(false);
        } else if (feedbackManagerOpen) {
          setFeedbackManagerOpen(false);
        }
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
      case 'f':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setFeedbackOpen(true);
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 800,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <FocusTimer
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onOpenFeedback={() => setFeedbackOpen(true)}
            settings={settings}
          />
        </Box>

        <SessionHistory
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          settings={settings}
        />

        <FocusSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onOpenFeedbackManager={() => setFeedbackManagerOpen(true)}
        />

        <FeedbackForm
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          onSubmit={async (feedback) => {
            await focusStorage.addFeedback(feedback);
          }}
        />

        <FeedbackManager
          open={feedbackManagerOpen}
          onClose={() => setFeedbackManagerOpen(false)}
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;
