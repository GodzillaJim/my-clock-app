import { useState, useEffect, useCallback, useMemo } from 'react';
import { createSessionGenerator } from '../utils/sessionGenerator';
import { SessionItem, SessionType } from '../types';
import { createStorageService } from '@/services/storage';

const defaultConfig = {
  focusDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  sessionsBeforeLongBreak: 4
};

export const useSessions = (storageKey = 'pomodoro-sessions') => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const storage = useMemo(() => createStorageService<SessionItem[]>(storageKey), [storageKey]);
  const generateSessions = useMemo(() => 
    createSessionGenerator(defaultConfig), 
    [defaultConfig]
  );

  // Load initial sessions
  useEffect(() => {
    const savedSessions = storage.load();
    if (savedSessions) {
      setSessions(savedSessions);
      setCurrentSessionIndex(prev => 
        Math.min(prev, savedSessions.length - 1)
      );
    }
  }, [storage]);

  // Persist sessions on change
  useEffect(() => {
    storage.save(sessions);
  }, [sessions, storage]);

  const createNewSessions = useCallback((totalMinutes: number) => {
    const generator = generateSessions(totalMinutes);
    const newSessions = Array.from(generator);
    setSessions(newSessions);
    setCurrentSessionIndex(0);
    return newSessions;
  }, [generateSessions]);

  const getCurrentSession = useCallback(() => 
    sessions[currentSessionIndex], 
    [sessions, currentSessionIndex]
  );

  return {
    sessions,
    currentSessionIndex,
    setCurrentSessionIndex,
    createNewSessions,
    getCurrentSession,
    updateSession: (sessionId: string, updates: Partial<SessionItem>) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, ...updates } : session
      ));
    }
  };
};