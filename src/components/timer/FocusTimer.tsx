import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  LinearProgress, 
  Paper, 
  Stack,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  PlayArrow, 
  Pause, 
  Stop, 
  SkipNext, 
  Settings,
  History as HistoryIcon,
  Remove,
  Add,
  Timer as TimerIcon
} from '@mui/icons-material';
import { 
  TimerState, 
  SessionType, 
  TimerSession, 
  CompletionStatus,
  AppSettings,
  formatTime,
  TimeDisplay,
  DEFAULT_SETTINGS
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { notificationService } from '@/services/notificationService';
import { v4 as uuidv4 } from 'uuid';

interface FocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  settings: AppSettings;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({ 
  onOpenSettings, 
  onOpenHistory, 
  settings 
}) => {
  const [timerState, setTimerState] = useState<TimerState>(TimerState.IDLE);
  const [currentSession, setCurrentSession] = useState<TimerSession | null>(null);
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>({
    current: '',
    sessionStart: '',
    expectedEnd: '',
    remainingTime: '',
    progress: 0
  });
  const [sessionCount, setSessionCount] = useState(0);
  const [nextSessionType, setNextSessionType] = useState<SessionType>(SessionType.FOCUS);
  const [quickDuration, setQuickDuration] = useState<number>(25); // Quick duration input
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    notificationService.setSettings(settings);
    initializeApp();
    
    // Handle visibility change to prevent timer from pausing when app loses focus
    const handleVisibilityChange = () => {
      if (isActiveRef.current) {
        syncTimer();
      }
    };
    
    const handleFocus = () => {
      if (isActiveRef.current) {
        syncTimer();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    updateTimeDisplay();
  }, [currentSession, timerState, settings.timeFormat]);

  useEffect(() => {
    // Update quick duration when settings change
    setQuickDuration(settings.focusDuration);
  }, [settings.focusDuration]);

  // Sync timer with actual elapsed time to fix accuracy issues
  const syncTimer = useCallback(() => {
    if (!currentSession || !startTimeRef.current || timerState !== TimerState.RUNNING) {
      return;
    }

    const now = Date.now();
    const actualElapsedMs = now - startTimeRef.current - currentSession.totalPausedTime;
    const actualElapsedSeconds = Math.floor(actualElapsedMs / 1000);
    const totalPlannedSeconds = currentSession.plannedDuration * 60;
    const newRemainingTime = Math.max(0, totalPlannedSeconds - actualElapsedSeconds);

    if (newRemainingTime !== currentSession.remainingTime) {
      setCurrentSession(prev => {
        if (!prev) return prev;
        return { ...prev, remainingTime: newRemainingTime };
      });
    }

    lastTickRef.current = now;
  }, [currentSession, timerState]);

  const initializeApp = async () => {
    try {
      await focusStorage.initialize();
      const appState = await focusStorage.getAppState();
      
      if (appState.currentSession) {
        const session = appState.currentSession;
        
        // Check if session should have completed by now
        if (session.state === TimerState.RUNNING) {
          const now = Date.now();
          const sessionStartTime = new Date(session.startTime).getTime();
          const totalElapsedMs = now - sessionStartTime - session.totalPausedTime;
          const totalPlannedMs = session.plannedDuration * 60 * 1000;
          
          if (totalElapsedMs >= totalPlannedMs) {
            // Session should be completed
            await saveCompletedSession(session, CompletionStatus.COMPLETED);
            setCurrentSession(null);
            setTimerState(TimerState.IDLE);
            
            // Show notification for completed session
            await notificationService.showNotification({
              type: session.type === SessionType.FOCUS ? 'session_complete' : 'break_complete',
              title: 'Session Completed!',
              body: `Your ${session.type} session finished while the app was inactive.`,
              sound: session.type === SessionType.FOCUS ? 'complete' : 'break',
              timestamp: new Date()
            });
          } else {
            // Resume the session with correct remaining time
            const remainingSeconds = Math.max(0, Math.floor((totalPlannedMs - totalElapsedMs) / 1000));
            const updatedSession = { ...session, remainingTime: remainingSeconds };
            
            setCurrentSession(updatedSession);
            setTimerState(TimerState.RUNNING);
            startTimeRef.current = sessionStartTime;
            startTimer();
          }
        } else {
          setCurrentSession(session);
          setTimerState(session.state);
          
          // Update tray for paused sessions
          if (window.electronAPI && session.state === TimerState.PAUSED) {
            await window.electronAPI.updateTrayStatus(`${session.type} Session Paused`);
          }
        }
      } else {
        // No active session, set tray to ready
        if (window.electronAPI) {
          await window.electronAPI.updateTrayStatus('Ready');
        }
      }
      
      const todayHistory = await focusStorage.getTodayHistory();
      setSessionCount(todayHistory.sessions.filter(s => s.type === SessionType.FOCUS).length);
      
      focusStorage.scheduleAutomaticReset();
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  const updateTimeDisplay = useCallback(() => {
    const now = new Date();
    
    setTimeDisplay({
      current: formatTime(now, settings.timeFormat),
      sessionStart: currentSession ? formatTime(currentSession.startTime, settings.timeFormat) : '',
      expectedEnd: currentSession ? calculateExpectedEndTime() : '',
      remainingTime: currentSession ? formatRemainingTime(currentSession.remainingTime) : '',
      progress: currentSession ? calculateProgress() : 0
    });
  }, [currentSession, settings.timeFormat]);

  const calculateExpectedEndTime = (): string => {
    if (!currentSession) return '';
    
    const now = new Date();
    const remainingMs = currentSession.remainingTime * 1000;
    const expectedEnd = new Date(now.getTime() + remainingMs);
    
    return formatTime(expectedEnd, settings.timeFormat);
  };

  const formatRemainingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateProgress = (): number => {
    if (!currentSession) return 0;
    const totalSeconds = currentSession.plannedDuration * 60;
    const elapsed = totalSeconds - currentSession.remainingTime;
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };

  const determineNextSessionType = (): SessionType => {
    if (nextSessionType === SessionType.FOCUS) {
      const completedFocusSessions = sessionCount + 1;
      if (completedFocusSessions % settings.sessionsBeforeLongBreak === 0) {
        return SessionType.LONG_BREAK;
      }
      return SessionType.SHORT_BREAK;
    }
    return SessionType.FOCUS;
  };

  const getSessionDuration = (type: SessionType): number => {
    switch (type) {
      case SessionType.FOCUS:
        // Use quick duration if timer is idle and it's a focus session
        return timerState === TimerState.IDLE ? quickDuration : settings.focusDuration;
      case SessionType.SHORT_BREAK:
        return settings.shortBreakDuration;
      case SessionType.LONG_BREAK:
        return settings.longBreakDuration;
      default:
        return timerState === TimerState.IDLE ? quickDuration : settings.focusDuration;
    }
  };

  const handleQuickDurationChange = (value: number) => {
    const clampedValue = Math.max(1, Math.min(120, value));
    setQuickDuration(clampedValue);
  };

  const startSession = async (type: SessionType = nextSessionType) => {
    try {
      const duration = getSessionDuration(type);
      const now = new Date();
      const newSession: TimerSession = {
        id: uuidv4(),
        type,
        sessionNumber: type === SessionType.FOCUS ? sessionCount + 1 : 0,
        plannedDuration: duration,
        remainingTime: duration * 60,
        startTime: now,
        pausedAt: null,
        totalPausedTime: 0,
        state: TimerState.RUNNING
      };

      setCurrentSession(newSession);
      setTimerState(TimerState.RUNNING);
      startTimeRef.current = now.getTime();
      isActiveRef.current = true;
      
      if (type === SessionType.FOCUS) {
        setSessionCount(prev => prev + 1);
        setNextSessionType(determineNextSessionType());
      } else {
        setNextSessionType(SessionType.FOCUS);
      }

      const appState = await focusStorage.getAppState();
      appState.currentSession = newSession;
      await focusStorage.saveAppState(appState);

      // Update system tray and window title
      if (window.electronAPI) {
        await window.electronAPI.updateTrayStatus(`${type} Session Running`);
      }

      startTimer();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const startTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    lastTickRef.current = Date.now();
    
    // Use a more frequent interval for better accuracy
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      
      // Always sync with actual elapsed time for accuracy
      syncTimer();
      
      setCurrentSession(prev => {
        if (!prev || prev.state !== TimerState.RUNNING || !startTimeRef.current) {
          return prev;
        }

        // Calculate actual remaining time based on elapsed time
        const actualElapsedMs = now - startTimeRef.current - prev.totalPausedTime;
        const actualElapsedSeconds = Math.floor(actualElapsedMs / 1000);
        const totalPlannedSeconds = prev.plannedDuration * 60;
        const actualRemainingTime = Math.max(0, totalPlannedSeconds - actualElapsedSeconds);

        // Play tick sound in last 10 seconds
        if (settings.enableTickSound && actualRemainingTime <= 10 && actualRemainingTime > 0) {
          notificationService.playTickSound();
        }

        // Check if session is complete
        if (actualRemainingTime === 0) {
          completeSession(prev);
          return { ...prev, remainingTime: 0, state: TimerState.COMPLETED };
        }

        const updatedSession = { ...prev, remainingTime: actualRemainingTime };
        
        // Save state periodically (every 30 seconds instead of every minute for better recovery)
        const timeSinceLastSave = now - lastTickRef.current;
        if (timeSinceLastSave >= 30000) {
          saveSessionState(updatedSession);
          lastTickRef.current = now;
        }

        // Update window title with remaining time every 10 seconds
        if (timeSinceLastSave >= 10000 && window.electronAPI) {
          const remainingMinutes = Math.floor(actualRemainingTime / 60);
          const remainingSeconds = actualRemainingTime % 60;
          const timeStr = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
          window.electronAPI.updateTrayStatus(`${prev.type} Session - ${timeStr} remaining`);
        }

        return updatedSession;
      });
    }, 500); // Check twice per second for better responsiveness
  };

  const pauseTimer = async () => {
    if (!currentSession || timerState !== TimerState.RUNNING) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    isActiveRef.current = false;
    const now = new Date();
    const pausedSession = {
      ...currentSession,
      state: TimerState.PAUSED,
      pausedAt: now
    };

    setCurrentSession(pausedSession);
    setTimerState(TimerState.PAUSED);

    const appState = await focusStorage.getAppState();
    appState.currentSession = pausedSession;
    await focusStorage.saveAppState(appState);

    // Update system tray
    if (window.electronAPI) {
      await window.electronAPI.updateTrayStatus(`${currentSession.type} Session Paused`);
    }
  };

  const resumeTimer = async () => {
    if (!currentSession || timerState !== TimerState.PAUSED) return;

    const now = new Date();
    const pausedDuration = currentSession.pausedAt ? 
      now.getTime() - currentSession.pausedAt.getTime() : 0;

    const resumedSession = {
      ...currentSession,
      state: TimerState.RUNNING,
      pausedAt: null,
      totalPausedTime: currentSession.totalPausedTime + pausedDuration
    };

    setCurrentSession(resumedSession);
    setTimerState(TimerState.RUNNING);
    isActiveRef.current = true;

    const appState = await focusStorage.getAppState();
    appState.currentSession = resumedSession;
    await focusStorage.saveAppState(appState);

    // Update system tray
    if (window.electronAPI) {
      await window.electronAPI.updateTrayStatus(`${currentSession.type} Session Running`);
    }

    startTimer();
  };

  const stopSession = async () => {
    if (!currentSession) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    isActiveRef.current = false;
    await saveCompletedSession(currentSession, CompletionStatus.INTERRUPTED);
    resetTimer();
  };

  const skipSession = async () => {
    if (!currentSession) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    isActiveRef.current = false;
    await saveCompletedSession(currentSession, CompletionStatus.SKIPPED);
    
    if (settings.autoStartNextSession) {
      const nextType = currentSession.type === SessionType.FOCUS ? 
        determineNextSessionType() : SessionType.FOCUS;
      startSession(nextType);
    } else {
      resetTimer();
    }
  };

  const completeSession = async (session: TimerSession) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    isActiveRef.current = false;
    await saveCompletedSession(session, CompletionStatus.COMPLETED);
    
    const notificationTitle = session.type === SessionType.FOCUS ? 
      'Focus Session Complete!' : 'Break Time Over!';
    
    const notificationBody = session.type === SessionType.FOCUS ?
      `Great job! You completed a ${session.plannedDuration}-minute focus session.` :
      `Break time is over. Ready for your next focus session?`;

    await notificationService.showNotification({
      type: session.type === SessionType.FOCUS ? 'session_complete' : 'break_complete',
      title: notificationTitle,
      body: notificationBody,
      sound: session.type === SessionType.FOCUS ? 'complete' : 'break',
      timestamp: new Date()
    });

    // Also send Electron notification
    if (window.electronAPI) {
      await window.electronAPI.sessionNotification({
        title: notificationTitle,
        body: notificationBody
      });
      await window.electronAPI.updateTrayStatus('Session Complete');
    }

    if (settings.autoStartNextSession) {
      const nextType = session.type === SessionType.FOCUS ? 
        determineNextSessionType() : SessionType.FOCUS;
      
      setTimeout(() => {
        startSession(nextType);
      }, 2000);
    } else {
      setTimerState(TimerState.COMPLETED);
      setTimeout(resetTimer, 3000);
    }
  };

  const saveCompletedSession = async (session: TimerSession, status: CompletionStatus) => {
    try {
      const endTime = new Date();
      const actualDurationMs = endTime.getTime() - session.startTime.getTime() - session.totalPausedTime;
      const actualDurationMinutes = Math.max(0, Math.round(actualDurationMs / (1000 * 60)));

      await focusStorage.addSession({
        id: session.id,
        type: session.type,
        sessionNumber: session.sessionNumber,
        plannedDuration: session.plannedDuration,
        actualDuration: actualDurationMinutes,
        startTime: session.startTime,
        endTime,
        pausedTime: session.totalPausedTime,
        completionStatus: status,
        remainingTime: session.remainingTime
      });

      const appState = await focusStorage.getAppState();
      appState.currentSession = null;
      await focusStorage.saveAppState(appState);
    } catch (error) {
      console.error('Failed to save completed session:', error);
    }
  };

  const saveSessionState = async (session: TimerSession) => {
    try {
      const appState = await focusStorage.getAppState();
      appState.currentSession = session;
      await focusStorage.saveAppState(appState);
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  };

  const resetTimer = async () => {
    setCurrentSession(null);
    setTimerState(TimerState.IDLE);
    setNextSessionType(SessionType.FOCUS);
    isActiveRef.current = false;
    startTimeRef.current = null;
    
    // Update system tray
    if (window.electronAPI) {
      await window.electronAPI.updateTrayStatus('Ready');
    }
  };

  const getSessionTypeLabel = (type: SessionType): string => {
    switch (type) {
      case SessionType.FOCUS:
        return 'Focus Session';
      case SessionType.SHORT_BREAK:
        return 'Short Break';
      case SessionType.LONG_BREAK:
        return 'Long Break';
      default:
        return 'Session';
    }
  };

  const getSessionTypeColor = (type: SessionType): 'primary' | 'secondary' | 'success' => {
    switch (type) {
      case SessionType.FOCUS:
        return 'primary';
      case SessionType.SHORT_BREAK:
        return 'secondary';
      case SessionType.LONG_BREAK:
        return 'success';
      default:
        return 'primary';
    }
  };

  const renderTimerDisplay = () => {
    // Format display time based on current session or quick duration
    const displayTime = timeDisplay.remainingTime || 
      `${Math.floor(quickDuration / 60).toString().padStart(2, '0')}:${(quickDuration % 60).toString().padStart(2, '0')}`;
    
    // Show different styling when idle vs active
    const isIdle = timerState === TimerState.IDLE;
    
    return (
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        {currentSession ? (
          <Chip 
            label={getSessionTypeLabel(currentSession.type)}
            color={getSessionTypeColor(currentSession.type)}
            sx={{ mb: 2, fontSize: '0.9rem' }}
          />
        ) : (
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              color: 'text.secondary',
              fontWeight: 500 
            }}
          >
            Ready to Focus
          </Typography>
        )}
        
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: { xs: '4rem', md: '6rem' },
            fontWeight: 300,
            fontFamily: 'monospace',
            lineHeight: 1,
            mb: 2,
            opacity: isIdle ? 0.8 : 1,
            color: isIdle ? 'text.secondary' : 'text.primary'
          }}
        >
          {displayTime}
        </Typography>

        {currentSession && (
          <LinearProgress 
            variant="determinate" 
            value={timeDisplay.progress}
            sx={{ 
              height: 8, 
              borderRadius: 4, 
              mb: 3,
              backgroundColor: 'rgba(0,0,0,0.1)'
            }}
          />
        )}
      </Box>
    );
  };

  const renderQuickDurationInput = () => {
    if (timerState !== TimerState.IDLE) return null;
    
    const commonDurations = [15, 25, 30, 45, 60];
    
    return (
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        {/* Main duration control */}
        <Paper 
          elevation={1} 
          sx={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            p: 1, 
            borderRadius: 2,
            backgroundColor: 'background.paper',
            mb: 2
          }}
        >
          <TimerIcon sx={{ mr: 1, color: 'text.secondary' }} />
          <IconButton
            size="small"
            onClick={() => handleQuickDurationChange(quickDuration - 5)}
            disabled={quickDuration <= 5}
          >
            <Remove />
          </IconButton>
          <Box sx={{ mx: 2, textAlign: 'center', minWidth: 90 }}>
            <Typography variant="body2" color="text.secondary">
              Session Length
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {quickDuration} min
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => handleQuickDurationChange(quickDuration + 5)}
            disabled={quickDuration >= 120}
          >
            <Add />
          </IconButton>
        </Paper>

        {/* Quick preset buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
          {commonDurations.map((duration) => (
            <Button
              key={duration}
              variant={quickDuration === duration ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setQuickDuration(duration)}
              sx={{ 
                minWidth: 45, 
                fontSize: '0.75rem',
                color: quickDuration === duration ? 'white' : 'text.secondary'
              }}
            >
              {duration}m
            </Button>
          ))}
        </Box>

        <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
          Quick presets • Use ±5min buttons • Settings for advanced options
        </Typography>
      </Box>
    );
  };

  const renderTimeInfo = () => (
    <Box sx={{ mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" color="text.secondary">Current Time</Typography>
          <Typography variant="h6">{timeDisplay.current}</Typography>
        </Box>
        
        {currentSession && settings.showSessionStartTime && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Started</Typography>
            <Typography variant="h6">{timeDisplay.sessionStart}</Typography>
          </Box>
        )}
        
        {currentSession && settings.showSessionEndTime && (
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">Ends at</Typography>
            <Typography variant="h6">{timeDisplay.expectedEnd}</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );

  const renderControls = () => (
    <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 4 }}>
      {timerState === TimerState.IDLE && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={() => startSession()}
          sx={{ px: 4 }}
        >
          Start {quickDuration}min Focus
        </Button>
      )}

      {timerState === TimerState.RUNNING && (
        <>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Pause />}
            onClick={pauseTimer}
          >
            Pause
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Stop />}
            onClick={stopSession}
            color="error"
          >
            Stop
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<SkipNext />}
            onClick={skipSession}
          >
            Skip
          </Button>
        </>
      )}

      {timerState === TimerState.PAUSED && (
        <>
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrow />}
            onClick={resumeTimer}
            sx={{ px: 4 }}
          >
            Resume
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Stop />}
            onClick={stopSession}
            color="error"
          >
            Stop
          </Button>
        </>
      )}

      {timerState === TimerState.COMPLETED && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={() => startSession()}
          sx={{ px: 4 }}
        >
          Start Next Session
        </Button>
      )}
    </Stack>
  );

  const renderActionButtons = () => (
    <Stack direction="row" spacing={1} justifyContent="center">
      <Tooltip title="Settings">
        <IconButton onClick={onOpenSettings}>
          <Settings />
        </IconButton>
      </Tooltip>
      <Tooltip title="Session History">
        <IconButton onClick={onOpenHistory}>
          <HistoryIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 4, 
        maxWidth: 600, 
        mx: 'auto',
        backgroundColor: 'transparent'
      }}
    >
      {renderTimerDisplay()}
      {renderQuickDurationInput()}
      {renderTimeInfo()}
      {renderControls()}
      {renderActionButtons()}
    </Paper>
  );
};