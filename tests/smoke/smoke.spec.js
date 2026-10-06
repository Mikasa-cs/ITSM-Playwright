// @ts-check
const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const { CREDENTIALS } = require('../../utils/auth');

test.describe('ITSM Smoke Tests - Role Authentication', () => {

  test('Admin user can authenticate and access System Administration', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
    await expect(page.getByText(/System Administration/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('IT Staff user can authenticate and access IT Staff portal', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(CREDENTIALS.itstaff.email, CREDENTIALS.itstaff.password);
    await expect(page.getByText(/IT Staff|Dashboard|Ticket Queue/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('Employee user can authenticate and access Employee portal', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(CREDENTIALS.employee.email, CREDENTIALS.employee.password);
    await expect(page.getByText(/Welcome|Employee|My Tickets|Support/i).first()).toBeVisible({ timeout: 20000 });
  });

});
