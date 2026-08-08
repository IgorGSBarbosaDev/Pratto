import { defineConfig, devices } from '@playwright/test';

const e2eEnvironmentFile = process.env.PRATTO_E2E_ENV_FILE ?? '../../.env.test';
const e2eWebPort = process.env.PRATTO_E2E_WEB_PORT ?? '3000';
const e2eBaseUrl = process.env.PRATTO_E2E_BASE_URL ?? `http://localhost:${e2eWebPort}`;
const withTestEnvironment = (command: string) =>
  `pnpm --filter @pratto/database exec dotenv -e "${e2eEnvironmentFile}" -o -- ${command}`;

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: e2eBaseUrl, trace: 'on-first-retry' },
  webServer: [
    {
      command: withTestEnvironment('pnpm --filter @pratto/api dev'),
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
    },
    {
      command: withTestEnvironment(`pnpm --filter @pratto/web exec next dev --port ${e2eWebPort}`),
      url: e2eBaseUrl,
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
