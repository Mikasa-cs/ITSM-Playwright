// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const dotenv = require('dotenv');
const path = require('path');

// Read environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup.js'),
  fullyParallel: false, // Run sequentially by default to avoid concurrent session conflicts on test tenant
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker avoids role session collision on shared user accounts
  reporter: [['list'], ['./reporter/excel-sync-reporter.js']],
  timeout: 120_000, // 2 minutes per test to accommodate cold-starts
  // Playwright empties its outputDir at the start of every run. Keep artifacts in a sub-folder so the
  // per-run Excel reports in test-results/excel/ are never wiped.
  outputDir: './test-results/artifacts',

  use: {
    baseURL: process.env.BASE_URL || 'https://ithelpdesk.vlinklabs.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1366, height: 768 },
    launchOptions: {
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
