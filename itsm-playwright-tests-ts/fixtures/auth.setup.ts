import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/common/LoginPage';
import { CREDENTIALS } from '../config/env';
import path from 'path';

const authDir = path.join(__dirname, '..', 'auth');

setup('authenticate as admin', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(CREDENTIALS.admin.valid.userId, CREDENTIALS.admin.valid.password);
  await login.expectNavigatedToDashboard();
  await page.context().storageState({ path: path.join(authDir, 'admin.json') });
});

setup('authenticate as it staff', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(CREDENTIALS.itStaff.valid.userId, CREDENTIALS.itStaff.valid.password);
  await login.expectNavigatedToDashboard();
  await page.context().storageState({ path: path.join(authDir, 'it-staff.json') });
});

setup('authenticate as employee', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(CREDENTIALS.employee.valid.userId, CREDENTIALS.employee.valid.password);
  await login.expectNavigatedToDashboard();
  await page.context().storageState({ path: path.join(authDir, 'employee.json') });
});
