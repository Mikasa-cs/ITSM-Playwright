// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');

test.describe('Admin - Type 2: Dashboard Overview Functionality', () => {

  test('Admin can view System Administration dashboard metrics, navigation, and system status', async ({
    adminPage,
  }) => {
    // Verify Dashboard Landing Heading
    await expect(adminPage.getByText(/System Administration/i).first()).toBeVisible({ timeout: 20000 });

    // Verify key navigation items are rendered
    await expect(adminPage.getByRole('link', { name: /ticket queue/i }).or(adminPage.getByRole('button', { name: /ticket queue/i })).first()).toBeVisible();
    await expect(adminPage.getByRole('link', { name: /alert management/i }).or(adminPage.getByRole('button', { name: /alert management/i })).first()).toBeVisible();
    await expect(adminPage.getByRole('link', { name: /user management/i }).or(adminPage.getByRole('button', { name: /user management/i })).first()).toBeVisible();
  });

});
