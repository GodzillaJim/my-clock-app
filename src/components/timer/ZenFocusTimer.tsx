import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Fade,
} from "@mui/material";
import {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  History,
  SkipNext,
  CheckCircleOutline,
  FastForward,
  AccessTime,
} from "@mui/icons-material";
import { useTimer } from "react-timer-hook";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CircularTimerRing } from "./CircularTimerRing";
import { AppSettings, CompletionStatus, SessionType, SessionRecord, SessionPlan, SessionPlanSegment, SegmentStatus } from "@/features/timer/types";
import { notificationService } from "@/services/notificationService";
import { focusStorage as focusStorageService } from "@/services/focusStorage";
import { persistenceService } from "@/services/persistenceService";
import { v4 as uuidv4 } from "uuid";
import { useTickSound } from "@/features/timer/hooks/useTickSound";

dayjs.extend(duration);

interface SimpleSession {
  type: "focus" | "break";
  duration: number;
  startTime: Date;
  endTime: Date;
}

const generateSessions = (
  totalMinutes: number,
  settings: AppSettings,
  planStartTime: Date = new Date()
): SimpleSession[] => {
  const totalSeconds = totalMinutes * 60;
  const sessions: SimpleSession[] = [];
  let remainingTime = totalSeconds;
  const focusDuration = settings.focusDuration * 60;
  const breakDuration = settings.shortBreakDuration * 60;
  let currentTime = planStartTime.getTime();

  while (remainingTime > 0) {
    if (sessions.length % 2 === 0) {
      const currentFocusDuration = Math.min(focusDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentFocusDuration * 1000);
      sessions.push({ type: "focus", duration: currentFocusDuration, startTime, endTime });
      remainingTime -= currentFocusDuration;
      currentTime = endTime.getTime();
    } else {
      const currentBreakDuration = Math.min(breakDuration, remainingTime);
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + currentBreakDuration * 1000);
      sessions.push({ type: "break", duration: currentBreakDuration, startTime, endTime });
      remainingTime -= currentBreakDuration;
      currentTime = endTime.getTime();
    }
  }
  return sessions;
};

const buildSessionPlan = (
  sessions: SimpleSession[],
  settings: AppSettings
): SessionPlan => {
  const now = Date.now();
  const segments: SessionPlanSegment[] = sessions.map((s, i) => ({
    id: uuidv4(),
    index: i,
    type: s.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
    plannedDuration: s.duration,
    actualDuration: null,
    expectedStartTime: s.startTime.getTime(),
    expectedEndTime: s.endTime.getTime(),
    actualStartTime: null,
    actualEndTime: null,
    status: 'pending' as SegmentStatus,
    pausedTime: 0,
    elapsedAtLastUpdate: 0,
  }));

  const totalPlanned = sessions.reduce((sum, s) => sum + s.duration, 0);

  return {
    id: uuidv4(),
    createdAt: now,
    status: 'active',
    segments,
    currentSegmentIndex: -1,
    settings: {
      focusDuration: settings.focusDuration,
      shortBreakDuration: settings.shortBreakDuration,
    },
    expectedEndTime: sessions.length > 0
      ? sessions[sessions.length - 1].endTime.getTime()
      : now,
    actualEndTime: null,
    interruptedAt: null,
    totalPlannedDuration: totalPlanned,
    totalElapsed: 0,
    lastUpdated: now,
  };
};

interface ZenFocusTimerProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  settings: AppSettings;
  onRunningStateChange?: (isRunning: boolean) => void;
  hideTopControls?: boolean;
  resumePlan?: SessionPlan | null;
  onResumeConsumed?: () => void;
}

export const ZenFocusTimer: React.FC<ZenFocusTimerProps> = ({
  onOpenSettings,
  onOpenHistory,
  settings,
  onRunningStateChange,
  hideTopControls = false,
  resumePlan,
  onResumeConsumed,
}) => {
  const [totalDuration, setTotalDuration] = useState(settings.focusDuration);
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [nextSessionExpiry, setNextSessionExpiry] = useState<Date | null>(null);
  const activeExpiryRef = useRef<Date | null>(null);

  // Session plan for comprehensive record keeping
  const [currentPlan, setCurrentPlan] = useState<SessionPlan | null>(null);
  const currentPlanRef = useRef<SessionPlan | null>(null);

  // Refs to hold latest state values for the timer callback
  const sessionsRef = useRef<SimpleSession[]>([]);
  const currentSessionIndexRef = useRef(0);
  const sessionStartTimeRef = useRef<Date | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    currentSessionIndexRef.current = currentSessionIndex;
  }, [currentSessionIndex]);

  useEffect(() => {
    sessionStartTimeRef.current = sessionStartTime;
  }, [sessionStartTime]);

  useEffect(() => {
    currentPlanRef.current = currentPlan;
  }, [currentPlan]);

  // Helper to update plan segment and persist
  const updatePlanSegment = (
    plan: SessionPlan,
    segmentIndex: number,
    segmentUpdates: Partial<SessionPlanSegment>,
    planUpdates?: Partial<SessionPlan>
  ): SessionPlan => {
    const updatedSegments = [...plan.segments];
    updatedSegments[segmentIndex] = { ...updatedSegments[segmentIndex], ...segmentUpdates };
    const totalElapsed = updatedSegments.reduce((sum, s) => {
      if (s.actualDuration !== null) return sum + s.actualDuration;
      return sum;
    }, 0);
    const updated: SessionPlan = {
      ...plan,
      segments: updatedSegments,
      totalElapsed,
      lastUpdated: Date.now(),
      ...planUpdates,
    };
    setCurrentPlan(updated);
    currentPlanRef.current = updated;
    persistenceService.savePlanSnapshot(updated);
    focusStorageService.saveSessionPlan(updated).catch(err =>
      console.error('Failed to persist plan:', err)
    );
    return updated;
  };

  // Handle automatic session transitions
  useEffect(() => {
    if (nextSessionExpiry) {
      // Defer the restart to avoid timing issues with onExpire callback
      setTimeout(() => {
        restart(nextSessionExpiry, true);
        activeExpiryRef.current = nextSessionExpiry;
      }, 0);
      setNextSessionExpiry(null); // Reset the trigger
    }
  }, [nextSessionExpiry]); // Removed restart from deps since it's stable

  const recordSession = async (status: CompletionStatus) => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || !sessionStartTime) return;

    const now = new Date();
    const actualDuration = Math.round((now.getTime() - sessionStartTime.getTime()) / 1000);

    const record: SessionRecord = {
      id: `${sessionStartTime.getTime()}-${currentSessionIndex}`,
      type: currentSession.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
      sessionNumber: currentSessionIndex + 1,
      plannedDuration: currentSession.duration,
      actualDuration: actualDuration,
      startTime: sessionStartTime,
      endTime: now,
      completionStatus: status,
      pausedTime: 0,
      remainingTime: 0,
    };

    try {
      await focusStorageService.addSession(record);
    } catch (error) {
      console.error("Failed to save session record:", error);
    }
  };

  const handleExpire = () => {
    // Use refs to get current values
    const currentSessions = sessionsRef.current;
    const currentIndex = currentSessionIndexRef.current;
    const startTime = sessionStartTimeRef.current;
    const plan = currentPlanRef.current;

    // Record the completed session
    const currentSession = currentSessions[currentIndex];
    if (currentSession && startTime) {
      const now = new Date();
      const actualDuration = Math.round((now.getTime() - startTime.getTime()) / 1000);

      const record: SessionRecord = {
        id: `${startTime.getTime()}-${currentIndex}`,
        type: currentSession.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
        sessionNumber: currentIndex + 1,
        plannedDuration: currentSession.duration,
        actualDuration: actualDuration,
        startTime: startTime,
        endTime: now,
        completionStatus: CompletionStatus.COMPLETED,
        pausedTime: 0,
        remainingTime: 0,
      };

      focusStorageService.addSession(record).catch((error) => {
        console.error("Failed to save session record:", error);
      });

      // Update plan segment as completed
      if (plan && currentIndex < plan.segments.length) {
        const nowTs = now.getTime();
        const segUpdates: Partial<SessionPlanSegment> = {
          status: 'completed',
          actualEndTime: nowTs,
          actualDuration,
          elapsedAtLastUpdate: actualDuration,
        };

        if (currentIndex < currentSessions.length - 1) {
          // Mark next segment as in_progress
          const nextIndex = currentIndex + 1;
          const updatedSegments = [...plan.segments];
          updatedSegments[currentIndex] = { ...updatedSegments[currentIndex], ...segUpdates };
          updatedSegments[nextIndex] = {
            ...updatedSegments[nextIndex],
            status: 'in_progress',
            actualStartTime: nowTs,
          };
          const totalElapsed = updatedSegments.reduce((sum, s) =>
            sum + (s.actualDuration || 0), 0);
          const updated: SessionPlan = {
            ...plan,
            segments: updatedSegments,
            currentSegmentIndex: nextIndex,
            totalElapsed,
            lastUpdated: nowTs,
          };
          setCurrentPlan(updated);
          currentPlanRef.current = updated;
          persistenceService.savePlanSnapshot(updated);
          focusStorageService.saveSessionPlan(updated).catch(err =>
            console.error('Failed to persist plan:', err));
        } else {
          // Last segment — plan is completed
          const updated = updatePlanSegment(plan, currentIndex, segUpdates, {
            status: 'completed',
            actualEndTime: nowTs,
          });
          persistenceService.clearPlanSnapshot();
          // Recalculate lifetime stats
          focusStorageService.recalculateLifetimeStats().catch(err =>
            console.error('Failed to recalculate stats:', err));
          setCurrentPlan(null);
          currentPlanRef.current = null;
        }
      }
    }

    // Check if there are more sessions
    if (currentIndex < currentSessions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentSessionIndex(nextIndex);
      setSessionStartTime(new Date()); // Track new session start
      const nextSession = currentSessions[nextIndex];
      const newExpiry = dayjs().add(nextSession.duration, "second").toDate();
      setNextSessionExpiry(newExpiry); // Trigger auto-start in useEffect

      notificationService.showNotification({
        type: nextSession.type === "focus" ? "session_start" : "break_complete",
        title: nextSession.type === "focus" ? "Focus Time!" : "Break Time!",
        body: nextSession.type === "focus" ? "Time to focus." : "Take a short break.",
        timestamp: new Date(),
      });
    } else {
      pause(); // Stop the timer
      setIsComplete(true);
      notificationService.showNotification({
        type: "session_complete",
        title: "Session Complete!",
        body: "Great work! You've completed your focus session.",
        timestamp: new Date(),
      });
      persistenceService.clearSnapshot();
    }
  };

  const { seconds, minutes, hours, pause, resume, restart, isRunning } = useTimer({
    expiryTimestamp: new Date(),
    autoStart: false,
    onExpire: handleExpire,
  });

  useTickSound(hours * 3600 + minutes * 60 + seconds, isRunning);

  const resetToIdle = () => {
    setIsComplete(false);
    pause(); // Stop the timer
    setSessions([]);
    setCurrentSessionIndex(0);
    setSessionStartTime(null);
    setShowControls(false);
    setCurrentPlan(null);
    currentPlanRef.current = null;
  };

  // Auto-save plan snapshot every 5 seconds while running
  useEffect(() => {
    if (isRunning && currentPlanRef.current && currentPlanRef.current.status === 'active') {
      const interval = setInterval(() => {
        const plan = currentPlanRef.current;
        if (!plan) return;
        const segIdx = plan.currentSegmentIndex;
        if (segIdx >= 0 && segIdx < plan.segments.length) {
          const seg = plan.segments[segIdx];
          const now = Date.now();
          const elapsed = seg.actualStartTime
            ? Math.round((now - seg.actualStartTime) / 1000) - Math.round(seg.pausedTime / 1000)
            : 0;
          const updatedSegments = [...plan.segments];
          updatedSegments[segIdx] = { ...seg, elapsedAtLastUpdate: elapsed };
          const totalElapsed = updatedSegments.reduce((sum, s) => {
            if (s.status === 'completed' || s.status === 'skipped') return sum + (s.actualDuration || 0);
            if (s.status === 'in_progress') return sum + elapsed;
            return sum;
          }, 0);
          const updated = { ...plan, segments: updatedSegments, totalElapsed, lastUpdated: now };
          currentPlanRef.current = updated;
          persistenceService.savePlanSnapshot(updated);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  useEffect(() => {
    onRunningStateChange?.(isRunning);
  }, [isRunning, onRunningStateChange]);

  const currentSession = sessions[currentSessionIndex];
  const sessionType = currentSession?.type || "focus";
  const isBreak = sessionType === "break";
  const isActive = sessions.length > 0 && isRunning;

  const displayTime = useMemo(() => {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0 && !isRunning) {
      return dayjs.duration(totalDuration, "minutes").format("mm:ss");
    }
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [hours, minutes, seconds, isRunning, totalDuration]);

  const calculateProgress = (): number => {
    if (!currentSession) return 0;
    const totalSeconds = currentSession.duration;
    const elapsed = totalSeconds - (hours * 3600 + minutes * 60 + seconds);
    return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  };

  const startSession = () => {
    const now = new Date();
    const newSessions = generateSessions(totalDuration, settings, now);
    setSessions(newSessions);
    setCurrentSessionIndex(0);

    // Build and persist session plan
    const plan = buildSessionPlan(newSessions, settings);
    plan.currentSegmentIndex = 0;
    plan.segments[0].status = 'in_progress';
    plan.segments[0].actualStartTime = now.getTime();
    setCurrentPlan(plan);
    currentPlanRef.current = plan;
    focusStorageService.saveSessionPlan(plan).catch(err =>
      console.error('Failed to save initial plan:', err)
    );
    persistenceService.savePlanSnapshot(plan);

    const firstSessionDuration = newSessions[0]?.duration || 0;
    const newExpiryTimestamp = dayjs().add(firstSessionDuration, "second").toDate();
    restart(newExpiryTimestamp, true); // Auto-start
    activeExpiryRef.current = newExpiryTimestamp;

    setSessionStartTime(now);
    setShowControls(true);

    notificationService.showNotification({
      type: "session_start",
      title: "Focus Started",
      body: `${totalDuration} minute focus session begun.`,
      timestamp: new Date(),
    });
  };

  const resumeFromPlan = (oldPlan: SessionPlan) => {
    const now = new Date();
    const nowTs = now.getTime();

    // Find remaining segments: not-yet-run (pending), the one that was running
    // (in_progress), or the one cut short by the interruption (interrupted).
    const remaining = oldPlan.segments.filter(
      s => s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted'
    );
    if (remaining.length === 0) return;

    // For a partially-elapsed first segment, continue with the time that remained.
    const firstSeg = remaining[0];
    const firstIsPartial = firstSeg.status === 'in_progress' || firstSeg.status === 'interrupted';
    const firstElapsedSoFar = Math.max(firstSeg.elapsedAtLastUpdate || 0, firstSeg.actualDuration || 0);
    const firstDuration = firstIsPartial
      ? Math.max(1, firstSeg.plannedDuration - firstElapsedSoFar)
      : firstSeg.plannedDuration;

    // Build SimpleSession[] from remaining segments
    let currentTime = nowTs;
    const newSessions: SimpleSession[] = remaining.map((seg, i) => {
      const dur = i === 0 ? firstDuration : seg.plannedDuration;
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime + dur * 1000);
      currentTime = endTime.getTime();
      return {
        type: seg.type === SessionType.FOCUS ? 'focus' as const : 'break' as const,
        duration: dur,
        startTime,
        endTime,
      };
    });

    // Build a new plan for the resumed session
    const newSegments: SessionPlanSegment[] = newSessions.map((s, i) => ({
      id: uuidv4(),
      index: i,
      type: s.type === 'focus' ? SessionType.FOCUS : SessionType.SHORT_BREAK,
      plannedDuration: s.duration,
      actualDuration: null,
      expectedStartTime: s.startTime.getTime(),
      expectedEndTime: s.endTime.getTime(),
      actualStartTime: null,
      actualEndTime: null,
      status: 'pending' as SegmentStatus,
      pausedTime: 0,
      elapsedAtLastUpdate: 0,
    }));

    const totalPlanned = newSessions.reduce((sum, s) => sum + s.duration, 0);
    const newPlan: SessionPlan = {
      id: uuidv4(),
      createdAt: nowTs,
      status: 'active',
      segments: newSegments,
      currentSegmentIndex: 0,
      settings: oldPlan.settings,
      expectedEndTime: newSessions[newSessions.length - 1].endTime.getTime(),
      actualEndTime: null,
      interruptedAt: null,
      totalPlannedDuration: totalPlanned,
      totalElapsed: 0,
      lastUpdated: nowTs,
    };

    // Mark first segment as in_progress
    newPlan.segments[0].status = 'in_progress';
    newPlan.segments[0].actualStartTime = nowTs;

    // Set all state
    setSessions(newSessions);
    setCurrentSessionIndex(0);
    setCurrentPlan(newPlan);
    currentPlanRef.current = newPlan;
    setSessionStartTime(now);
    setShowControls(true);
    setIsComplete(false);

    // Persist
    focusStorageService.saveSessionPlan(newPlan).catch(err =>
      console.error('Failed to save resumed plan:', err)
    );
    persistenceService.savePlanSnapshot(newPlan);

    // Finalize the old plan: its remaining work has been carried into the new
    // plan, so mark those segments `skipped` — this stops the old plan from
    // being flagged resumable again (avoiding duplicate resumes). Any time
    // already elapsed on the interrupted segment is preserved so stats stay
    // accurate (the new plan only carries the *remaining* time).
    const finalizedOldSegments = oldPlan.segments.map(s => {
      if (s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted') {
        const elapsed = Math.max(s.elapsedAtLastUpdate || 0, s.actualDuration || 0);
        return {
          ...s,
          status: 'skipped' as SegmentStatus,
          actualEndTime: s.actualEndTime ?? nowTs,
          actualDuration: elapsed,
        };
      }
      return s;
    });
    const finalizedOld: SessionPlan = {
      ...oldPlan,
      segments: finalizedOldSegments,
      status: 'interrupted',
      interruptedAt: nowTs,
      actualEndTime: nowTs,
      totalElapsed: finalizedOldSegments.reduce((sum, s) => sum + (s.actualDuration || 0), 0),
      lastUpdated: nowTs,
    };
    focusStorageService.saveSessionPlan(finalizedOld).catch(err =>
      console.error('Failed to finalize old plan:', err)
    );

    // Start timer
    const firstExpiry = dayjs().add(firstDuration, "second").toDate();
    restart(firstExpiry, true);
    activeExpiryRef.current = firstExpiry;

    notificationService.showNotification({
      type: "session_start",
      title: "Session Resumed",
      body: `Resuming with ${remaining.length} segments (${Math.round(totalPlanned / 60)}m remaining).`,
      timestamp: new Date(),
    });
  };

  // Auto-trigger resume when resumePlan prop is provided
  useEffect(() => {
    if (resumePlan && sessions.length === 0 && !isComplete) {
      resumeFromPlan(resumePlan);
      onResumeConsumed?.();
    }
  }, [resumePlan]);

  const pauseSession = () => {
    pause();
  };

  const resumeSession = () => {
    resume();
  };

  const stopSession = () => {
    // Record the interrupted session before stopping
    if (sessions.length > 0 && sessionStartTime) {
      recordSession(CompletionStatus.INTERRUPTED);
    }

    // Mark plan as abandoned
    const plan = currentPlanRef.current;
    if (plan) {
      const now = Date.now();
      const updatedSegments = plan.segments.map((seg, idx) => {
        if (idx === plan.currentSegmentIndex) {
          const elapsed = seg.actualStartTime
            ? Math.round((now - seg.actualStartTime) / 1000)
            : 0;
          return { ...seg, status: 'interrupted' as SegmentStatus, actualEndTime: now, actualDuration: elapsed };
        }
        if (seg.status === 'pending') return seg; // leave pending as-is
        return seg;
      });
      const totalElapsed = updatedSegments.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
      const abandoned: SessionPlan = {
        ...plan,
        segments: updatedSegments,
        status: 'abandoned',
        actualEndTime: now,
        totalElapsed,
        lastUpdated: now,
      };
      setCurrentPlan(null);
      currentPlanRef.current = null;
      focusStorageService.saveSessionPlan(abandoned).catch(err =>
        console.error('Failed to save abandoned plan:', err));
      persistenceService.clearPlanSnapshot();
      focusStorageService.recalculateLifetimeStats().catch(err =>
        console.error('Failed to recalculate stats:', err));
    }

    const newExpiryTimestamp = dayjs().add(sessions[0]?.duration || 0, "second").toDate();
    restart(newExpiryTimestamp, false); // Don't auto-start
    activeExpiryRef.current = newExpiryTimestamp;
    pause(); // Stop the timer
    setCurrentSessionIndex(0);
    setSessions([]);
    setShowControls(false);
    setSessionStartTime(null);
    persistenceService.clearSnapshot();
  };

  const skipToNext = () => {
    if (currentSessionIndex < sessions.length - 1) {
      // Record current session as skipped
      recordSession(CompletionStatus.SKIPPED);

      // Update plan: mark current as skipped, next as in_progress
      const plan = currentPlanRef.current;
      if (plan && currentSessionIndex < plan.segments.length) {
        const now = Date.now();
        const seg = plan.segments[currentSessionIndex];
        const elapsed = seg.actualStartTime
          ? Math.round((now - seg.actualStartTime) / 1000)
          : 0;
        const nextIndex = currentSessionIndex + 1;
        const updatedSegments = [...plan.segments];
        updatedSegments[currentSessionIndex] = {
          ...seg, status: 'skipped', actualEndTime: now, actualDuration: elapsed,
        };
        if (nextIndex < updatedSegments.length) {
          updatedSegments[nextIndex] = {
            ...updatedSegments[nextIndex], status: 'in_progress', actualStartTime: now,
          };
        }
        const totalElapsed = updatedSegments.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
        const updated: SessionPlan = {
          ...plan, segments: updatedSegments, currentSegmentIndex: nextIndex,
          totalElapsed, lastUpdated: now,
        };
        setCurrentPlan(updated);
        currentPlanRef.current = updated;
        persistenceService.savePlanSnapshot(updated);
        focusStorageService.saveSessionPlan(updated).catch(err =>
          console.error('Failed to persist plan:', err));
      }

      const nextIndex = currentSessionIndex + 1;
      setCurrentSessionIndex(nextIndex);
      setSessionStartTime(new Date());
      const nextSession = sessions[nextIndex];
      const newExpiry = dayjs().add(nextSession.duration, "second").toDate();
      setNextSessionExpiry(newExpiry); // Trigger auto-start in useEffect

      notificationService.showNotification({
        type: nextSession.type === "focus" ? "session_start" : "break_complete",
        title: nextSession.type === "focus" ? "Focus Time!" : "Break Time!",
        body: nextSession.type === "focus" ? "Time to focus." : "Take a short break.",
        timestamp: new Date(),
      });
    }
  };

  const fastForward = () => {
    if (!isRunning) return;

    // Calculate remaining time in seconds
    const remainingSeconds = hours * 3600 + minutes * 60 + seconds;

    // Reduce by 30 seconds, minimum 1 second
    const newRemainingSeconds = Math.max(1, remainingSeconds - 30);

    // Calculate new expiry time
    const newExpiry = dayjs().add(newRemainingSeconds, "second").toDate();
    restart(newExpiry, true);
    activeExpiryRef.current = newExpiry;
  };

  const isPaused = sessions.length > 0 && !isRunning && !isComplete;

  const getExpectedEndTime = () => {
    if (isActive || isPaused) {
      // When running or paused, show end time for the current session
      return dayjs().add(hours, 'hour').add(minutes, 'minute').add(seconds, 'second');
    }
    // When idle, show end time for the entire plan if we start now
    return dayjs().add(totalDuration, 'minute');
  };

  const getPlanEndTime = (): dayjs.Dayjs | null => {
    if (!currentPlan || sessions.length <= 1) return null;
    // Current segment remaining time
    const currentRemaining = hours * 3600 + minutes * 60 + seconds;
    // Sum remaining duration for all segments after current
    let futureTime = 0;
    for (let i = currentSessionIndex + 1; i < sessions.length; i++) {
      futureTime += sessions[i].duration;
    }
    return dayjs().add(currentRemaining + futureTime, 'second');
  };

  // Show completion screen when all sessions are done
  if (isComplete) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
        }}
      >
        <CheckCircleOutline
          sx={{
            fontSize: 100,
            color: 'success.main',
            mb: 3,
          }}
        />
        <Typography variant="h4" sx={{ fontWeight: 500, mb: 2 }}>
          Session Complete!
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', mb: 4, maxWidth: 300 }}
        >
          Great work! You've successfully completed your focus session.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={resetToIdle}
          sx={{ px: 4, py: 1.5 }}
        >
          Start New Session
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: 4,
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPaused && setShowControls(false)}
    >
      {/* Top Controls - Settings & History (hidden when in dashboard layout) */}
      {!hideTopControls && (
        <Fade in={showControls || !isActive}>
          <Box
            sx={{
              position: "absolute",
              top: 24,
              right: 24,
              display: "flex",
              gap: 1,
            }}
          >
            <Tooltip title="History">
              <IconButton onClick={onOpenHistory} size="small" sx={{ color: "text.secondary" }}>
                <History />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={onOpenSettings} size="small" sx={{ color: "text.secondary" }}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Fade>
      )}

      {/* Session Type Label */}
      <Typography
        variant="overline"
        sx={{
          color: isBreak ? "secondary.main" : "primary.main",
          letterSpacing: "0.2em",
          mb: 4,
          opacity: isActive ? 1 : 0.5,
          transition: "all 0.3s ease",
        }}
      >
        {isActive ? (isBreak ? "BREAK" : "FOCUS") : "READY"}
      </Typography>

      {/* Circular Timer */}
      <CircularTimerRing
        progress={calculateProgress()}
        size={300}
        strokeWidth={6}
        isRunning={isActive}
        isBreak={isBreak}
      >
        <Typography
          variant="h1"
          className={isActive ? (isBreak ? "neon-text-secondary" : "neon-text") : ""}
          sx={{
            fontSize: "4rem",
            fontWeight: 200,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
            color: isActive ? (isBreak ? "secondary.main" : "primary.main") : "text.secondary",
            transition: "all 0.3s ease",
          }}
        >
          {displayTime}
        </Typography>

        {/* Expected End Time */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
          <AccessTime fontSize="small" sx={{ color: 'text.secondary', fontSize: '0.875rem' }} />
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary' }}
          >
            {sessions.length > 1 && (isActive || isPaused) ? 'Segment ends ' : 'Ends at '}{getExpectedEndTime().format('h:mm A')}
          </Typography>
        </Box>
        {/* Overall session plan end time */}
        {(() => {
          const planEnd = getPlanEndTime();
          return planEnd && (isActive || isPaused) ? (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', mt: 0.25 }}
            >
              Session ends at {planEnd.format('h:mm A')}
            </Typography>
          ) : null;
        })()}

        {/* Session indicator */}
        {sessions.length > 1 && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", mt: 0.5 }}
          >
            {currentSessionIndex + 1} / {sessions.length}
          </Typography>
        )}
      </CircularTimerRing>

      {/* Controls */}
      <Fade in={showControls || !isActive || isPaused}>
        <Box sx={{ mt: 6, display: "flex", gap: 2, alignItems: "center" }}>
          {!isRunning && sessions.length === 0 && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={startSession}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: "1rem",
              }}
            >
              Start {totalDuration}m Focus
            </Button>
          )}

          {isPaused && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={resumeSession}
              sx={{ px: 4, py: 1.5 }}
            >
              Resume
            </Button>
          )}

          {isActive && (
            <>
              <IconButton
                onClick={pauseSession}
                sx={{
                  width: 56,
                  height: 56,
                  border: "1px solid",
                  borderColor: "primary.main",
                }}
              >
                <Pause />
              </IconButton>

              <Tooltip title="Skip to next">
                <IconButton
                  onClick={skipToNext}
                  size="small"
                  sx={{ color: "text.secondary" }}
                >
                  <SkipNext />
                </IconButton>
              </Tooltip>

              {import.meta.env.DEV && (
                <Tooltip title="Fast forward -30s (Test)">
                  <IconButton
                    onClick={fastForward}
                    size="small"
                    sx={{ color: "warning.main" }}
                  >
                    <FastForward />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}

          {(isActive || isPaused) && (
            <Tooltip title="Stop session">
              <IconButton
                onClick={stopSession}
                size="small"
                sx={{ color: "error.main" }}
              >
                <Stop />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Fade>

      {/* Duration Quick Select (only when not active) */}
      <Fade in={!isActive && !isPaused}>
        <Box sx={{ mt: 4, display: "flex", gap: 1 }}>
          {(settings.quickPresets || [15, 25, 30, 45, 60]).map((preset) => (
            <Button
              key={preset}
              variant={totalDuration === preset ? "contained" : "text"}
              size="small"
              onClick={() => setTotalDuration(preset)}
              sx={{
                minWidth: 48,
                color: totalDuration === preset ? undefined : "text.secondary",
              }}
            >
              {preset}m
            </Button>
          ))}
        </Box>
      </Fade>
    </Box>
  );
};
