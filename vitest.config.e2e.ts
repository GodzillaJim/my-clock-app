import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/e2e.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // threads: false, // Disabling threads can be helpful for E2E tests
  },
})
