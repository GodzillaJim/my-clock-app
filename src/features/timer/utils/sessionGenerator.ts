import { v4 } from "uuid";
import { SessionItem, SessionType } from "../types";

interface SessionConfig {
  focusDuration: number;
  shortBreak: number;
  longBreak: number;
  sessionsBeforeLongBreak: number;
}

export const createSession = (
  type: SessionType,
  minutes: number,
  sessionNumber?: number
): SessionItem => ({
  id: v4(),
  type,
  minutes,
  sessionNumber,
  remainingMinutes: minutes,
  createdAt: new Date(),
  skipped: false,
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
        yield createSession(SessionType.LONG_BREAK, breakDuration);
      }
    }

    yield createSession(SessionType.COMPLETION, 0);
  };
};
