import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './config/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, testDir: './fixtures' },

    // Login tests (ITSM-01..03) run unauthenticated, so keep them separate.
    {
      name: 'login',
      testMatch: /tests\/admin\/login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'admin',
      testDir: './tests/admin',
      testIgnore: /login\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'auth/admin.json' },
    },
    {
      name: 'employee',
      testDir: './tests/employee',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'auth/employee.json' },
    },
    {
      name: 'it-staff',
      testDir: './tests/it-staff',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'auth/it-staff.json' },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke',
      testDir: './tests/smoke',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
