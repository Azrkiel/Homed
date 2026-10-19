import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/web/test/**/*.test.ts'],
    // Playwright specs run under `npm run e2e`, not vitest.
    exclude: ['**/node_modules/**', 'apps/web/e2e/**'],
    environment: 'node',
  },
});
