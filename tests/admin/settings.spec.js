// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');

test.describe('Admin - Settings', () => {

  test('Admin can navigate to system Settings panel', async ({
    adminPage,
    adminDashboardPage,
  }) => {
    await adminDashboardPage.goToSettings();
    await expect(adminPage.getByRole('heading', { name: /settings/i }).or(adminPage.getByText(/settings/i).first())).toBeVisible({ timeout: 15000 });
  });

});
