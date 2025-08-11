// Timer accuracy test utility for development/debugging

export class TimerAccuracyTest {
  private startTime: number | null = null;
  private expectedDuration: number = 0; // in seconds
  private checkInterval: NodeJS.Timeout | null = null;

  startTest(durationInSeconds: number): void {
    this.startTime = Date.now();
    this.expectedDuration = durationInSeconds;
    
    console.log(`Starting timer accuracy test for ${durationInSeconds} seconds`);
    console.log(`Start time: ${new Date().toISOString()}`);
    
    // Check accuracy every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkAccuracy();
    }, 10000);
    
    // Final check when expected to be done
    setTimeout(() => {
      this.finalCheck();
    }, durationInSeconds * 1000);
  }

  private checkAccuracy(): void {
    if (!this.startTime) return;
    
    const now = Date.now();
    const actualElapsed = (now - this.startTime) / 1000;
    const expectedElapsed = Math.floor(actualElapsed / 10) * 10; // Round to nearest 10s
    
    console.log(`Timer check - Expected: ${expectedElapsed}s, Actual: ${actualElapsed.toFixed(1)}s, Diff: ${(actualElapsed - expectedElapsed).toFixed(1)}s`);
  }

  private finalCheck(): void {
    if (!this.startTime || !this.checkInterval) return;
    
    const now = Date.now();
    const actualElapsed = (now - this.startTime) / 1000;
    const diff = actualElapsed - this.expectedDuration;
    
    console.log(`Timer test complete:`);
    console.log(`Expected duration: ${this.expectedDuration}s`);
    console.log(`Actual duration: ${actualElapsed.toFixed(1)}s`);
    console.log(`Difference: ${diff.toFixed(1)}s`);
    console.log(`Accuracy: ${((1 - Math.abs(diff) / this.expectedDuration) * 100).toFixed(2)}%`);
    
    clearInterval(this.checkInterval);
    this.checkInterval = null;
    this.startTime = null;
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.startTime) {
      this.finalCheck();
    }
  }
}

// Export singleton for easy use
export const timerTest = new TimerAccuracyTest();

// Usage in development:
// import { timerTest } from '@/utils/timerTest';
// timerTest.startTest(60); // Test 1-minute timer