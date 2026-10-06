import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/common/LoginPage';
import { CREDENTIALS } from '../../config/env';

/**
 * ITSM-01 (Admin), ITSM-02 (IT Dashboard), ITSM-03 (Employee Dashboard):
 * each has 4 scenarios — valid/valid, valid/invalid, invalid/valid, invalid/invalid.
 * These run unauthenticated (no storageState), which is why this file has its
 * own Playwright project ("login") in playwright.config.ts.
 */
const scenarios: {
  role: keyof typeof CREDENTIALS;
  dashboardName: string;
  testIdPrefix: string;
}[] = [
  { role: 'admin', dashboardName: 'Admin Dashboard', testIdPrefix: 'ITSM-01' },
  { role: 'itStaff', dashboardName: 'IT Dashboard', testIdPrefix: 'ITSM-02' },
  { role: 'employee', dashboardName: 'Employee Dashboard', testIdPrefix: 'ITSM-03' },
];

test.describe('Login Functionality', () => {
  for (const { role, dashboardName, testIdPrefix } of scenarios) {
    const creds = CREDENTIALS[role];

    test(`[${testIdPrefix}-1] Login (${dashboardName}) — valid user id and valid password`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(creds.valid.userId, creds.valid.password);
      await login.expectNavigatedToDashboard();
    });

    test(`[${testIdPrefix}-2] Login (${dashboardName}) — valid user id, invalid password`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(
        creds.validUserInvalidPassword.userId,
        creds.validUserInvalidPassword.password
      );
      await login.expectLoginFailed();
    });

    test(`[${testIdPrefix}-3] Login (${dashboardName}) — invalid user id, valid password`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(
        creds.invalidUserValidPassword.userId,
        creds.invalidUserValidPassword.password
      );
      await login.expectLoginFailed();
    });

    test(`[${testIdPrefix}-4] Login (${dashboardName}) — invalid user id and invalid password`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(creds.invalidBoth.userId, creds.invalidBoth.password);
      await login.expectLoginFailed();
    });
  }

  test('[ITSM-04] Verify ticket detail page opens from Support Incident queue', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDENTIALS.admin.valid.userId, CREDENTIALS.admin.valid.password);
    await login.expectNavigatedToDashboard();

    // TODO: confirm the exact nav label for the queue in the real app
    await page.getByRole('link', { name: /ticket queue|support incidents?/i }).click();
    await page.locator('[data-testid="ticket-row"], tr, .ticket-card').first().click();
    await expect(page).toHaveURL(/ticket/i);
  });
});
