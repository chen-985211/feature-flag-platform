import { defineConfig } from '@playwright/test';
import process from 'node:process';
const artifacts = process.env.E2E_ARTIFACTS_DIR;
const containerURL = process.env.E2E_CONTAINER_URL;
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 5000 },
  outputDir: artifacts ? `${artifacts}/results` : '../test-results/e2e',
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: artifacts
          ? `${artifacts}/report`
          : '../playwright-report',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL: containerURL ?? 'http://127.0.0.1:18090',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: containerURL
    ? undefined
    : {
        command: 'node ../scripts/tasks.mjs e2e-server',
        url: 'http://127.0.0.1:18090/health/ready',
        reuseExistingServer: false,
        timeout: 60000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
      },
});
