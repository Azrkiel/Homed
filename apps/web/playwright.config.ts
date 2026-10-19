import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

// Fresh JSON store per run, so every e2e run starts from the seed.
const dataDir = mkdtempSync(join(tmpdir(), 'homed-e2e-'));
const PORT = 3020;

export default defineConfig({
  testDir: 'e2e',
  // One shared server and JSON store: run specs one at a time so journeys do not race each other.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // The build runs first via `npm run e2e` (root). Here we only start the built app.
    command: `node ../../node_modules/next/dist/bin/next start --port ${PORT}`,
    cwd: '.',
    url: `http://localhost:${PORT}/about`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...process.env,
      HOMED_DATA_DIR: dataDir,
      HOMED_SESSION_SECRET: 'e2e-secret',
      HOMED_ADMIN_EMAILS: 'admin@virginia.edu',
      HOMED_TODAY: '2026-10-19',
    } as Record<string, string>,
  },
});
