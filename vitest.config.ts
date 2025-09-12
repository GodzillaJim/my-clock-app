import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    testTimeout: 1000 * 29,
    setupFiles: ['./src/__tests__/setup.ts'],
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
