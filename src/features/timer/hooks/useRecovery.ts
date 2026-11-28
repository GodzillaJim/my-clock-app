import { useState, useEffect, useRef } from 'react';
import { persistenceService } from '@/services/persistenceService';
import { services } from '@/services/domain';
import {
  SessionPlan,
  SessionPlanSegment,
  SessionType,
  getTodayDateString,
  formatDurationFromSeconds,
} from '../types';
import { createLogger } from '@/services/logger';

const log = createLogger('useRecovery');

// Persisted so a dismissed recovery doesn't re-nag on every subsequent launch.
const DISMISSED_KEY = 'FOCUS_RECOVERY_DISMISSED_PLAN_ID';

export interface RecoveryInfo {
  plan: SessionPlan;
  completedSegments: number;
  totalSegments: number;
  completedFocusTime: number; // seconds
  remainingFocusTime: number; // seconds
  remainingSegments: number;
  interruptedAt: Date;
  plannedEndTime: Date;
  segmentAtInterruption: SessionPlanSegment | null;
  // Formatted strings for display
  completedTimeFormatted: string;
  remainingTimeFormatted: string;
  interruptedAtFormatted: string;
  plannedEndFormatted: string;
}

const getDismissedId = (): string | null => {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
};
const setDismissedId = (id: string): void => {
  try {
    localStorage.setItem(DISMISSED_KEY, id);
  } catch {
    /* ignore */
  }
};

/** A plan is resumable if it stopped short and still has segments left to run. */
const planHasRemaining = (plan: SessionPlan): boolean =>
  plan.segments.some(
    (s) => s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted',
  );

// Build display-ready recovery info from a plan without mutating it.
const buildRecoveryInfo = (plan: SessionPlan, interruptedAt: number): RecoveryInfo => {
  const segIdx = plan.currentSegmentIndex;
  let interruptedSeg: SessionPlanSegment | null = null;

  if (segIdx >= 0 && segIdx < plan.segments.length) {
    const seg = plan.segments[segIdx];
    const elapsed = seg.actualStartTime
      ? Math.round((interruptedAt - seg.actualStartTime) / 1000)
      : (seg.actualDuration ?? seg.elapsedAtLastUpdate);
    interruptedSeg = {
      ...seg,
      status: 'interrupted',
      actualEndTime: interruptedAt,
      actualDuration: elapsed,
    };
  }

  const completedSegs = plan.segments.filter(
    (s) => s.status === 'completed' || s.status === 'skipped',
  );
  const pendingSegs = plan.segments.filter((s) => s.status === 'pending');

  const completedFocusTime = plan.segments
    .filter((s) => s.type === SessionType.FOCUS && s.status === 'completed')
    .reduce((sum, s) => sum + (s.actualDuration || 0), 0);

  const remainingFocusTime = plan.segments
    .filter(
      (s) =>
        s.type === SessionType.FOCUS &&
        (s.status === 'pending' || s.status === 'in_progress' || s.status === 'interrupted'),
    )
    .reduce((sum, s) => {
      // The interrupted/in-progress segment only has its remaining time left.
      const elapsedSoFar = Math.max(s.elapsedAtLastUpdate || 0, s.actualDuration || 0);
      const remaining =
        s.status === 'pending' ? s.plannedDuration : Math.max(0, s.plannedDuration - elapsedSoFar);
      return sum + remaining;
    }, 0);

  // Build a display plan with the interrupted segment marked.
  const displayPlan = { ...plan };
  if (interruptedSeg && segIdx >= 0) {
    displayPlan.segments = [...plan.segments];
    displayPlan.segments[segIdx] = interruptedSeg;
  }

  return {
    plan: displayPlan,
    completedSegments: completedSegs.length,
    totalSegments: plan.segments.length,
    completedFocusTime,
    remainingFocusTime,
    remainingSegments:
      pendingSegs.length +
      (interruptedSeg &&
      interruptedSeg.status !== 'completed' &&
      interruptedSeg.status !== 'skipped'
        ? 1
        : 0),
    interruptedAt: new Date(interruptedAt),
    plannedEndTime: new Date(plan.expectedEndTime),
    segmentAtInterruption: interruptedSeg,
    completedTimeFormatted: formatDurationFromSeconds(completedFocusTime),
    remainingTimeFormatted: formatDurationFromSeconds(remainingFocusTime),
    interruptedAtFormatted: new Date(interruptedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    }),
    plannedEndFormatted: new Date(plan.expectedEndTime).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
};

export const useRecovery = () => {
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Keep the raw plan for resume (before finalization) and whether it came from
  // the live snapshot (still `active`) or from an already-finalized stored plan.
  const rawPlanRef = useRef<SessionPlan | null>(null);
  const fromSnapshotRef = useRef<boolean>(false);
  const interruptedAtRef = useRef<number>(0);

  useEffect(() => {
    checkForInterruptedPlan();
  }, []);

  const checkForInterruptedPlan = async () => {
    const dismissedId = getDismissedId();

    // 1. Prefer the live crash snapshot — the freshest record of an interruption.
    const snapshot = await persistenceService.loadPlanSnapshot();
    if (snapshot?.plan && snapshot.plan.status === 'active') {
      const plan = snapshot.plan;
      if (plan.id === dismissedId) {
        // User already dismissed this one; retire the stale snapshot.
        persistenceService.clearPlanSnapshot();
      } else {
        rawPlanRef.current = JSON.parse(JSON.stringify(plan));
        fromSnapshotRef.current = true;
        interruptedAtRef.current = snapshot.lastUpdated;
        setRecoveryInfo(buildRecoveryInfo(plan, snapshot.lastUpdated));
        return;
      }
    } else if (snapshot?.plan) {
      // Snapshot exists but is no longer active — clean it up.
      persistenceService.clearPlanSnapshot();
    }

    // 2. Fallback: an interrupted plan may still be resumable even if the
    // snapshot is gone (e.g. reconciled on a previous launch). Offer the most
    // recent one from today that hasn't been dismissed. Only interrupted`n    // plans qualify: those were cut short by a crash or shutdown, while an
    // bandoned plan was stopped on purpose (History can still resume it).
    try {
      const todaysPlans = await services.plans.forDate(getTodayDateString());
      const candidates = todaysPlans
        .filter((p) => p.status === 'interrupted' && p.id !== dismissedId && planHasRemaining(p))
        .sort((a, b) => (b.lastUpdated || b.createdAt) - (a.lastUpdated || a.createdAt));

      if (candidates.length > 0) {
        const plan = candidates[0];
        rawPlanRef.current = JSON.parse(JSON.stringify(plan));
        fromSnapshotRef.current = false;
        const interruptedAt = plan.interruptedAt || plan.actualEndTime || plan.lastUpdated;
        interruptedAtRef.current = interruptedAt;
        setRecoveryInfo(buildRecoveryInfo(plan, interruptedAt));
      }
    } catch (err) {
      log.error('Failed to check for resumable plans:', err);
    }
  };

  const finalizePlanAsInterrupted = () => {
    const plan = rawPlanRef.current;
    if (!plan) return;

    // Only the live snapshot plan is still `active` and needs finalizing;
    // fallback plans are already recorded as interrupted.
    if (fromSnapshotRef.current) {
      const interruptedAt = interruptedAtRef.current;
      const segIdx = plan.currentSegmentIndex;

      if (segIdx >= 0 && segIdx < plan.segments.length) {
        const seg = plan.segments[segIdx];
        const elapsed = seg.actualStartTime
          ? Math.round((interruptedAt - seg.actualStartTime) / 1000)
          : seg.elapsedAtLastUpdate;

        plan.segments[segIdx] = {
          ...seg,
          status: 'interrupted',
          actualEndTime: interruptedAt,
          actualDuration: elapsed,
        };
      }

      plan.status = 'interrupted';
      plan.interruptedAt = interruptedAt;
      plan.actualEndTime = interruptedAt;
      plan.totalElapsed = plan.segments.reduce((sum, s) => sum + (s.actualDuration || 0), 0);

      services.plans.save(plan).catch((err) => log.error('Failed to save interrupted plan:', err));
      persistenceService.clearPlanSnapshot();

      services.stats
        .recalculate()
        .catch((err) => log.error('Failed to recalculate stats after recovery:', err));
    }

    rawPlanRef.current = null;
  };

  const dismiss = () => {
    const plan = rawPlanRef.current;
    if (plan) setDismissedId(plan.id);
    finalizePlanAsInterrupted();
    setDismissed(true);
    setRecoveryInfo(null);
  };

  const resume = (): SessionPlan | null => {
    const plan = rawPlanRef.current;
    if (!plan) return null;

    // Mark as handled so the banner doesn't reappear for this plan; the timer
    // will create a fresh plan for the resumed run.
    setDismissedId(plan.id);
    persistenceService.clearPlanSnapshot();
    rawPlanRef.current = null;
    setDismissed(true);
    setRecoveryInfo(null);

    return plan;
  };

  return {
    recoveryInfo: dismissed ? null : recoveryInfo,
    dismiss,
    resume,
  };
};
