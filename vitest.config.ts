import { defineConfig } from 'vitest/config';

// Test projects (unit, e2e) are defined in vitest.workspace.ts.
// This file holds options that apply to the whole run.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Ratchet: the run fails if coverage drops below these, and `autoUpdate`
      // raises them here whenever coverage improves. Commit the bumped values.
      thresholds: {
        autoUpdate: true,
        lines: 11.33,
        statements: 11.33,
        branches: 73.85,
        functions: 41.66,
      },
    },
  },
});
