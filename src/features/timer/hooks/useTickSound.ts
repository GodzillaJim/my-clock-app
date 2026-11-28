import { useEffect } from 'react';
import { notificationService } from '@/services/notificationService';

/** Seconds before the end of a countdown during which a tick plays each second. */
export const TICK_WINDOW_SECONDS = 10;

/**
 * Plays the tick sound once per second during the last few seconds of a running
 * countdown. Whether it is audible is decided by the `enableTickSound` setting
 * inside `notificationService.playTickSound`.
 */
export function useTickSound(remainingSeconds: number, isRunning: boolean): void {
  useEffect(() => {
    if (isRunning && remainingSeconds > 0 && remainingSeconds <= TICK_WINDOW_SECONDS) {
      void notificationService.playTickSound();
    }
  }, [remainingSeconds, isRunning]);
}
