import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: [
    {
      command: 'set -a; . ../../.env.test; set +a; pnpm --filter @pratto/api dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
    },
    {
      command: 'set -a; . ../../.env.test; set +a; pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
