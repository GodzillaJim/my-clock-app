import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  LinearProgress, 
  Paper, 
  Stack,
  Chip,
  IconButton,
  Tooltip,
  TextField
} from '@mui/material';
import { 
  PlayArrow, 
  Pause, 
  Stop, 
  Settings,
  History as HistoryIcon,
  Remove,
  Add,
  Timer as TimerIcon,
  Feedback,
  History,
  FastForward,
  Coffee,
  Work
} from '@mui/icons-material';
import { CompletionScreen } from './CompletionScreen';
import { 
  SessionType, 
  AppSettings
} from '@/features/timer/types';
import { notificationService } from '@/services/notificationService';

// Simple session generation following SessionTimer approach
const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds  
const BREAK_DURATION = 5 * 60;  // 5 minutes in seconds

interface SimpleSession {
  type: 'focus' | 'break';
  duration: number; // in seconds
}

const generateSessions = (totalMinutes: number): SimpleSession[] => {
  const totalSeconds = totalMinutes * 60;
  const sessions: SimpleSession[] = [];
  let remainingTime = totalSeconds;

  while (remainingTime > 0) {
    if (sessions.length % 2 === 0) {
      // Focus session
      const focusDuration = Math.min(FOCUS_DURATION, remainingTime);
      sessions.push({ type: 'focus', duration: focusDuration });
      remainingTime -= focusDuration;
    } else {
      // Break session
      const breakDuration = Math.min(BREAK_DURATION, remainingTime);
      sessions.push({ type: 'break', duration: breakDuration });
      remainingTime -= breakDuration;
    }
  }

  console.log(`Generated simple session plan for ${totalMinutes}min total:`, sessions);
  return sessions;
};

interface FocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
  settings: AppSettings;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({ 
  onOpenSettings, 
  onOpenHistory, 
  onOpenFeedback,
  settings 
}) => {
  // Defensive check to prevent rendering with undefined settings
  if (!settings) {
    return <Box>Loading...</Box>;
  }
  // Simple state management following SessionTimer approach
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [quickDuration, setQuickDuration] = useState<number>(25);
  const [isComplete, setIsComplete] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Initialize sessions when component mounts or quickDuration changes
  useEffect(() => {
    if (quickDuration > 0) {
      setSessions(generateSessions(quickDuration));
      setCurrentSessionIndex(0);
      setRemainingTime(0);
    }
  }, [quickDuration]);

  // Timer effect - runs every second when active
  useEffect(() => {
    if (isRunning && remainingTime > 0) {
      const interval = setInterval(() => {
        setRemainingTime(time => {
          if (time <= 1) {
            // Session completed
            handleSessionComplete();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
      
      setIntervalId(interval);
      return () => clearInterval(interval);
    } else if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [isRunning, remainingTime]);

  const handleSessionComplete = () => {
    if (currentSessionIndex < sessions.length - 1) {
      // Move to next session
      setCurrentSessionIndex(prev => prev + 1);
      setRemainingTime(sessions[currentSessionIndex + 1].duration);
    } else {
      // All sessions complete
      setIsRunning(false);
      setIsComplete(true);
    }
  };

  // Simple helper functions following SessionTimer approach
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateProgress = (): number => {
    if (!sessions[currentSessionIndex]) return 0;
    const totalSeconds = sessions[currentSessionIndex].duration;
    const elapsed = totalSeconds - remainingTime;
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };

  const handleQuickDurationChange = (value: number) => {
    const clampedValue = Math.max(1, Math.min(240, value));
    setQuickDuration(clampedValue);
  };

  // Simple start/stop functions following SessionTimer approach
  const startSession = (customDuration?: number) => {
    const duration = customDuration || quickDuration;
    setSessions(generateSessions(duration));
    setCurrentSessionIndex(0);
    setRemainingTime(sessions.length > 0 ? sessions[0].duration : generateSessions(duration)[0].duration);
    setIsRunning(true);
    setIsComplete(false);
  };

  const pauseSession = () => {
    setIsRunning(false);
  };

  const resumeSession = () => {
    setIsRunning(true);
  };

  const stopSession = () => {
    setIsRunning(false);
    setCurrentSessionIndex(0);
    setRemainingTime(0);
  };

  // Remove complex pause/resume logic - SessionTimer approach
  const fastForwardSession = (seconds: number) => {
    setRemainingTime(prev => Math.max(0, prev - seconds));
  };

  const skipSession = () => {
    setIsRunning(false);
    setCurrentSessionIndex(0);
    setRemainingTime(0);
  };

  // Removed - handled in handleSessionComplete

  const resetTimer = () => {
    setIsRunning(false);
    setCurrentSessionIndex(0);
    setRemainingTime(0);
    setSessions([]);
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
    // Simple display logic following SessionTimer approach
    const currentSession = sessions[currentSessionIndex];
    const displayTime = remainingTime > 0 ? formatTime(remainingTime) : formatTime(quickDuration * 60);
    const sessionType = currentSession?.type || 'focus';
    const isActive = isRunning && remainingTime > 0;
    
    return (
      <Box sx={{ textAlign: 'center', width: '100%' }}>
        {/* Session Type Indicator */}
        {isActive ? (
          <Chip 
            label={sessionType === 'focus' ? 'Focus Session' : 'Break'}
            color={sessionType === 'focus' ? 'primary' : 'secondary'}
            size="small"
            sx={{ mb: 3 }}
          />
        ) : (
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              mb: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            Ready to Focus
          </Typography>
        )}
        
        {/* Clean Timer Display */}
        <Typography 
          variant="h1" 
          component="div"
          sx={{ 
            fontSize: { xs: '4rem', sm: '5rem', md: '6rem' },
            fontWeight: 300,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            lineHeight: 1,
            mb: 2,
            color: isActive ? 'primary.main' : 'text.secondary',
            transition: 'color 0.3s ease',
            fontVariantNumeric: 'tabular-nums',
            WebkitFontFeatureSettings: '"tnum"',
            fontFeatureSettings: '"tnum"'
          }}
        >
          {displayTime}
        </Typography>
        
        {/* Session Status */}
        {isActive && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              display: 'block',
              mb: 3
            }}
          >
            {Math.round(calculateProgress())}% complete
          </Typography>
        )}

        {isActive && (
          <Box sx={{ width: '100%', mb: 4 }}>
            <LinearProgress 
              variant="determinate" 
              value={calculateProgress()}
              sx={{ 
                height: 4, 
                borderRadius: 2,
                backgroundColor: 'divider',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  backgroundColor: 'primary.main'
                }
              }}
            />
          </Box>
        )}

        {/* Session Plan Visualization */}
        {sessions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Session {currentSessionIndex + 1} of {sessions.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
              {sessions.map((session, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: index < currentSessionIndex ? 'success.main' :
                      index === currentSessionIndex ? 'primary.main' : 'grey.300',
                    border: index === currentSessionIndex ? '2px solid' : 'none',
                    borderColor: 'primary.dark',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: index <= currentSessionIndex ? 'white' : 'grey.600',
                    fontWeight: 'bold'
                  }}
                  title={`${session.type === 'focus' ? 'Focus' : 'Break'} - ${Math.floor(session.duration / 60)}min`}
                >
                  {session.type === 'focus' ? 'F' : 'B'}
                </Box>
              ))}
            </Box>
            
            {/* Next Session Preview */}
            {sessions.length > currentSessionIndex + 1 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Next: {sessions[currentSessionIndex + 1].type === 'focus' ? 'Focus Session' : 'Break'}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const renderQuickDurationInput = () => {
    if (isRunning) return null;
    
    const commonDurations = [15, 25, 45, 90];
    
    return (
      <Box sx={{ textAlign: 'center', mb: 4, width: '100%' }}>
        {/* Duration selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
          <IconButton
            onClick={() => handleQuickDurationChange(quickDuration - 5)}
            disabled={quickDuration <= 5}
            size="small"
          >
            <Remove fontSize="small" />
          </IconButton>
          
          <Box sx={{ mx: 3, textAlign: 'center', minWidth: 100 }}>
            <Typography variant="h5" sx={{ fontWeight: 500, mb: 0.5 }}>
              {quickDuration}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              minutes
            </Typography>
          </Box>
          
          <IconButton
            onClick={() => handleQuickDurationChange(quickDuration + 5)}
            disabled={quickDuration >= 240}
            size="small"
          >
            <Add fontSize="small" />
          </IconButton>
        </Box>

        {/* Quick presets */}
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
          {commonDurations.map((duration) => (
            <Chip
              key={duration}
              label={`${duration}m`}
              variant={quickDuration === duration ? 'filled' : 'outlined'}
              color={quickDuration === duration ? 'primary' : 'default'}
              onClick={() => setQuickDuration(duration)}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      </Box>
    );
  };

  // Removed complex time info - SessionTimer approach is simpler

  const renderControls = () => (
    <Stack 
      direction={{ xs: 'column', sm: 'row' }} 
      spacing={2} 
      justifyContent="center" 
      alignItems="center"
      sx={{ width: '100%' }}
    >
      {!isRunning && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={() => startSession()}
          sx={{ 
            minWidth: { xs: '100%', sm: 200 },
            py: 1.5
          }}
        >
          Start {quickDuration}min Focus
        </Button>
      )}

      {isRunning && (
        <>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Pause />}
            onClick={pauseSession}
            sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
          >
            Pause
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<Stop />}
            onClick={stopSession}
            color="error"
            sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
          >
            Stop
          </Button>
          <Button
            variant="text"
            size="large"
            onClick={skipSession}
            sx={{ 
              minWidth: { xs: '100%', sm: 'auto' },
              color: 'text.secondary' 
            }}
          >
            Skip
          </Button>
        </>
      )}

      {!isRunning && remainingTime > 0 && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={resumeSession}
          color="success"
          sx={{ minWidth: { xs: '100%', sm: 160 } }}
        >
          Resume
        </Button>
      )}

      {isRunning && (
        <Tooltip title="Fast Forward 60s (for testing)">
          <IconButton onClick={() => fastForwardSession(60)} color="secondary">
            <FastForward />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  const renderActionButtons = () => (
    <Stack direction="row" spacing={1} justifyContent="center">
      <Tooltip title="Settings">
        <IconButton onClick={onOpenSettings} size="small">
          <Settings fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Session History">
        <IconButton onClick={onOpenHistory} size="small">
          <History fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Send Feedback">
        <IconButton onClick={onOpenFeedback} size="small">
          <Feedback fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (isComplete) {
    return <CompletionScreen onClose={() => setIsComplete(false)} />;
  }

  return (
    <Box sx={{ width: '100%', textAlign: 'center' }}>
      {renderTimerDisplay()}
      {renderQuickDurationInput()}
      {renderControls()}
      <Box sx={{ mt: 4 }}>
        {renderActionButtons()}
      </Box>
    </Box>
  );
};