import React, { useState, useEffect } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { ToolSwitcher } from './components/timer/ToolSwitcher';
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
  const [currentTool, setCurrentTool] = useState(0);
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
          main: '#2563eb', // Clean blue
          dark: '#1d4ed8',
          light: '#3b82f6'
        },
        secondary: {
          main: '#64748b', // Neutral gray
          dark: '#475569',
          light: '#94a3b8'
        },
        success: {
          main: '#059669',
        },
        error: {
          main: '#dc2626',
        },
        warning: {
          main: '#d97706',
        },
        background: {
          default: isDarkMode ? '#0f172a' : '#ffffff',
          paper: isDarkMode ? '#1e293b' : '#ffffff'
        },
        text: {
          primary: isDarkMode ? '#f1f5f9' : '#0f172a',
          secondary: isDarkMode ? '#94a3b8' : '#64748b'
        },
        divider: isDarkMode ? '#334155' : '#e2e8f0'
      },
      typography: {
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        h1: {
          fontSize: '4rem',
          fontWeight: 300,
          lineHeight: 1.1,
          letterSpacing: '-0.025em'
        },
        h2: {
          fontSize: '2.5rem',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.025em'
        },
        h3: {
          fontSize: '1.875rem',
          fontWeight: 500,
          lineHeight: 1.3
        },
        h4: {
          fontSize: '1.5rem',
          fontWeight: 500,
          lineHeight: 1.4
        },
        h5: {
          fontSize: '1.25rem',
          fontWeight: 500,
          lineHeight: 1.5
        },
        h6: {
          fontSize: '1.125rem',
          fontWeight: 500,
          lineHeight: 1.5
        },
        body1: {
          fontSize: '1rem',
          lineHeight: 1.6
        },
        body2: {
          fontSize: '0.875rem',
          lineHeight: 1.5
        },
        button: {
          fontSize: '0.875rem',
          fontWeight: 500,
          textTransform: 'none' as const,
          letterSpacing: '0.01em'
        },
        caption: {
          fontSize: '0.75rem',
          lineHeight: 1.4,
          color: isDarkMode ? '#94a3b8' : '#64748b'
        }
      },
      shape: {
        borderRadius: 8,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: 8,
              fontWeight: 500,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              }
            },
            contained: {
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              }
            }
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              boxShadow: isDarkMode 
                ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
                : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            }
          }
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: 8
            }
          }
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 6,
              fontWeight: 500
            }
          }
        },
        MuiTextField: {
          styleOverrides: {
            root: {
              '& .MuiOutlinedInput-root': {
                '&:focus-visible': {
                  outline: 'none'
                }
              }
            }
          }
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              '&:focus-visible': {
                outline: 'none'
              },
              '& input:focus-visible': {
                outline: 'none'
              }
            }
          }
        },
        MuiInputBase: {
          styleOverrides: {
            root: {
              '&:focus-visible': {
                outline: 'none'
              }
            },
            input: {
              '&:focus-visible': {
                outline: 'none'
              }
            }
          }
        },
      },
    });

    setTheme(newTheme);
  };

  const handleSettingsChange = (newSettings: AppSettings) => {
    console.log('App: handleSettingsChange called with:', newSettings);
    console.log('App: Current quickPresets:', settings.quickPresets, '-> New quickPresets:', newSettings.quickPresets);
    setSettings(newSettings);
    notificationService.setSettings(newSettings);
  };

  const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', handleKeyDown);
    
    // Setup Electron IPC listeners for tray and global shortcuts
    try {
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
    } catch (error) {
      console.warn('Electron API not available:', error);
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
          p: { xs: 2, sm: 4 },
          backgroundColor: 'background.default'
        }}
      >
        <Box
          component="main"
          sx={{
            width: '100%',
            maxWidth: 480,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4
          }}
        >
          <ToolSwitcher
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onOpenFeedback={() => setFeedbackOpen(true)}
            settings={settings}
            initialTool={currentTool}
            onToolChange={setCurrentTool}
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
