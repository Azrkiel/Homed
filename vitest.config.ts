import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The web app's "@/..." import alias (apps/web/tsconfig.json), so server actions can be tested directly.
    alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/web/test/**/*.test.ts'],
    // Playwright specs run under `npm run e2e`, not vitest.
    exclude: ['**/node_modules/**', 'apps/web/e2e/**'],
    environment: 'node',
  },
});
