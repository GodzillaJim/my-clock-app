import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineWorkspace([
  {
    resolve: { alias: { '@': src } },
    test: {
      name: 'unit',
      root,
      include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
      environment: 'jsdom',
      globals: true,
      setupFiles: [fileURLToPath(new URL('./src/__tests__/setup.ts', import.meta.url))],
      // Pre-bundle MUI: transforming the icon barrel file-by-file dominates run time.
      // `noDiscovery` bundles exactly this list up front. With discovery on, Vite
      // re-bundles mid-run when it meets a new import, and on Windows swapping the
      // cache while workers read it fails (EPERM) and leaves a broken cache.
      deps: {
        optimizer: {
          web: {
            enabled: true,
            noDiscovery: true,
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
]);
