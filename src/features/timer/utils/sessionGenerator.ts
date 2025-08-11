import { v4 } from "uuid";
import { SessionItem, SessionType, CompletionStatus, TimerState } from "../types";

interface SessionConfig {
  focusDuration: number;
  shortBreak: number;
  longBreak: number;
  sessionsBeforeLongBreak: number;
}

export const createSession = (
  type: SessionType,
  minutes: number,
  sessionNumber: number = 1
): SessionItem => ({
  id: v4(),
  type,
  sessionNumber,
  plannedDuration: minutes,
  actualDuration: 0,
  startTime: new Date(),
  endTime: null,
  pausedTime: 0,
  completionStatus: CompletionStatus.INTERRUPTED,
  remainingTime: minutes * 60,
  // Backward compatibility properties
  minutes,
  remainingMinutes: minutes,
  completedAt: undefined
});

export const createSessionGenerator = (config: SessionConfig) => {
  let sessionCount = 0;

  return function* (totalMinutes: number): Generator<SessionItem> {
    let remaining = totalMinutes;
    sessionCount = 0;

    while (remaining > 0) {
      sessionCount++;
      const focusDuration = Math.min(remaining, config.focusDuration);
      yield createSession(SessionType.FOCUS, focusDuration, sessionCount);
      remaining -= focusDuration;

      if (remaining > 0) {
        const breakType =
          sessionCount % config.sessionsBeforeLongBreak === 0
            ? "longBreak"
            : "shortBreak";
        const breakDuration =
          breakType === "longBreak" ? config.longBreak : config.shortBreak;
        const breakSessionType = breakType === "longBreak" ? SessionType.LONG_BREAK : SessionType.SHORT_BREAK;
        yield createSession(breakSessionType, breakDuration);
      }
    }
  };
};
