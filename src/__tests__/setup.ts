// Global test setup for vitest
import { expect } from 'vitest';
import '@testing-library/jest-dom';

// Extend global namespace to include expect
declare global {
  var expect: typeof import('vitest').expect;
}

// Make expect available globally
global.expect = expect;
