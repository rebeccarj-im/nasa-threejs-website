// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  // Only scan E2E files (avoid picking up unit tests run by Vitest)
  testDir: 'e2e',
  testMatch: /.*\.e2e\.(ts|tsx)$/,

  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  // CI-friendly defaults
  forbidOnly: isCI,          // fail if .only is committed
  retries: isCI ? 2 : 0,     // retry flakies on CI
  workers: isCI ? 2 : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Start the Next.js dev server for tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000, // allow extra time for first boot on CI
  },

  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari',  use: { ...devices['iPhone 12'] } },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
});
