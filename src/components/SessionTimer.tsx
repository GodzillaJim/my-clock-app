'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, TextField, Typography, Paper, Stack, LinearProgress, Chip } from '@mui/material';
import { PlayArrow, Pause, Stop, Coffee, Work, FastForward } from '@mui/icons-material';

interface SessionTimerProps {
  defaultMinutes?: number;
}

type SessionType = 'focus' | 'break';

interface Session {
  type: SessionType;
  duration: number; // in seconds
}

const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60;  // 5 minutes in seconds

const SessionTimer: React.FC<SessionTimerProps> = ({ defaultMinutes = 25 }) => {
  const [totalMinutes, setTotalMinutes] = useState(defaultMinutes);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // Calculate sessions when total minutes change
  useEffect(() => {
    const totalSeconds = totalMinutes * 60;
    const newSessions: Session[] = [];
    let remainingTime = totalSeconds;

    while (remainingTime > 0) {
      if (newSessions.length % 2 === 0) {
        // Focus session
        const focusDuration = Math.min(FOCUS_DURATION, remainingTime);
        newSessions.push({ type: 'focus', duration: focusDuration });
        remainingTime -= focusDuration;
      } else {
        // Break session
        const breakDuration = Math.min(BREAK_DURATION, remainingTime);
        newSessions.push({ type: 'break', duration: breakDuration });
        remainingTime -= breakDuration;
      }
    }

    setSessions(newSessions);
  }, [totalMinutes]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, testMode ? 100 : 1000); // 10x speed in test mode
    } else if (timeLeft === 0 && isRunning && sessions.length > 0) {
      // Current session completed
      if (currentSessionIndex < sessions.length - 1) {
        // Move to next session
        const nextIndex = currentSessionIndex + 1;
        setCurrentSessionIndex(nextIndex);
        setTimeLeft(sessions[nextIndex].duration);
      } else {
        // All sessions completed
        setIsRunning(false);
        setSessionStarted(false);
        setTestMode(false); // Reset test mode when sessions complete
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, currentSessionIndex, sessions, testMode]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentSession = () => {
    return sessions[currentSessionIndex];
  };

  const handleStart = useCallback(() => {
    if (!sessionStarted && sessions.length > 0) {
      setSessionStarted(true);
      setCurrentSessionIndex(0);
      setTimeLeft(sessions[0].duration);
    }
    setIsRunning(true);
  }, [sessionStarted, sessions]);

  const handlePause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(0);
    setCurrentSessionIndex(0);
    setSessionStarted(false);
    setTestMode(false);
  }, []);

  const handleFastForward = useCallback(() => {
    if (sessions.length > 0 && currentSessionIndex < sessions.length - 1) {
      // Skip to next session
      const nextIndex = currentSessionIndex + 1;
      setCurrentSessionIndex(nextIndex);
      setTimeLeft(sessions[nextIndex].duration);
    } else if (currentSessionIndex === sessions.length - 1) {
      // Complete all sessions
      setIsRunning(false);
      setTimeLeft(0);
      setCurrentSessionIndex(0);
      setSessionStarted(false);
      setTestMode(false);
    }
  }, [sessions, currentSessionIndex]);

  const handleMinutesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value) || 0;
    setTotalMinutes(Math.max(1, Math.min(120, value)));
  };

  const currentSession = getCurrentSession();
  const progress = currentSession && currentSession.duration > 0 
    ? ((currentSession.duration - timeLeft) / currentSession.duration) * 100 
    : 0;

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1" align="center">
          Session Timer
        </Typography>

        <TextField
          label="Total Session Length (minutes)"
          type="number"
          value={totalMinutes}
          onChange={handleMinutesChange}
          disabled={sessionStarted}
          fullWidth
          InputProps={{
            inputProps: { min: 1, max: 120 }
          }}
        />

        {/* Session breakdown display */}
        {sessions.length > 0 && !sessionStarted && (
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Session Breakdown:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {sessions.map((session, index) => (
                <Chip
                  key={index}
                  icon={session.type === 'focus' ? <Work /> : <Coffee />}
                  label={`${Math.floor(session.duration / 60)}m`}
                  color={session.type === 'focus' ? 'primary' : 'default'}
                  size="small"
                  sx={{ mb: 0.5 }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Current session indicator */}
        {sessionStarted && currentSession && (
          <Box sx={{ textAlign: 'center' }}>
            <Chip
              icon={currentSession.type === 'focus' ? <Work /> : <Coffee />}
              label={currentSession.type === 'focus' ? 'Focus Time' : 'Break Time'}
              color={currentSession.type === 'focus' ? 'primary' : 'success'}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              Session {currentSessionIndex + 1} of {sessions.length}
              {testMode && ' (10x Speed)'}
            </Typography>
          </Box>
        )}

        <Box sx={{ position: 'relative', pt: 2 }}>
          <Typography 
            variant="h2" 
            component="div" 
            align="center" 
            sx={{ 
              fontFamily: 'monospace',
              color: currentSession?.type === 'break' ? 'success.main' : 'text.primary'
            }}
          >
            {formatTime(timeLeft)}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            color={currentSession?.type === 'break' ? 'success' : 'primary'}
            sx={{ mt: 2, height: 8, borderRadius: 4 }}
          />
        </Box>

        <Stack direction="row" spacing={2} justifyContent="center">
          {!isRunning && !sessionStarted && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrow />}
              onClick={handleStart}
              size="large"
              disabled={sessions.length === 0}
            >
              Start
            </Button>
          )}
          
          {isRunning && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<Pause />}
              onClick={handlePause}
              size="large"
            >
              Pause
            </Button>
          )}
          
          {!isRunning && sessionStarted && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrow />}
              onClick={handleStart}
              size="large"
            >
              Resume
            </Button>
          )}
          
          {sessionStarted && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Stop />}
              onClick={handleStop}
              size="large"
            >
              Stop
            </Button>
          )}
        </Stack>

        {/* Test Mode Controls */}
        {sessionStarted && (
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Test Controls
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                size="small"
                onClick={() => setTestMode(!testMode)}
                color={testMode ? 'secondary' : 'inherit'}
              >
                {testMode ? 'Normal Speed' : '10x Speed'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FastForward />}
                onClick={handleFastForward}
                disabled={!sessionStarted || sessions.length === 0}
              >
                Skip Session
              </Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default SessionTimer;
