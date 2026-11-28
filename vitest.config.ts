import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': src } },
        test: {
          name: 'unit',
          root,
          include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
          environment: 'jsdom',
          globals: true,
          setupFiles: [fileURLToPath(new URL('./src/__tests__/setup.ts', import.meta.url))],
          // Pre-bundle React/MUI up front: transforming the MUI icon barrel
          // file-by-file otherwise dominates run time.
          deps: {
            optimizer: {
              client: {
                enabled: true,
                include: [
                  'react',
                  'react-dom',
                  'react/jsx-runtime',
                  'react/jsx-dev-runtime',
                  '@emotion/react',
                  '@emotion/styled',
                  '@mui/material',
                  '@mui/icons-material',
                ],
              },
            },
          },
        },
      },
      {
        test: {
          name: 'e2e',
          root,
          // Requires a test-mode build first: `npm run test:e2e` does that
          include: ['test/**/*.spec.ts'],
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Ratchet: the run fails if coverage drops below these, and `autoUpdate`
      // raises them here whenever coverage improves. Commit the bumped values.
      thresholds: {
        autoUpdate: true,
        lines: 14.96,
        statements: 14.79,
        branches: 12.51,
        functions: 9.49,
      },
    },
  },
});
