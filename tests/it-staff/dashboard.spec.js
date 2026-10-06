// @ts-check
const { test, expect } = require('../../fixtures/itstaff.fixture');

test.describe('IT Staff - Dashboard', () => {

  test('IT Staff can view operational dashboard and metrics', async ({
    itStaffPage,
    itStaffDashboardPage,
  }) => {
    await itStaffDashboardPage.verifyDashboardLoaded();
    await expect(itStaffPage.getByText(/Ticket Queue|Dashboard|Assigned/i).first()).toBeVisible({ timeout: 15000 });
  });

});
