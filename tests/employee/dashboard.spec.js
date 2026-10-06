// @ts-check
const { test, expect } = require('../../fixtures/employee.fixture');

test.describe('Employee - Dashboard', () => {

  test('Employee can view self-service portal dashboard', async ({
    employeePage,
    employeeDashboardPage,
  }) => {
    await employeeDashboardPage.verifyDashboardLoaded();
    await expect(employeePage.getByText(/Welcome|Employee|Support|My Tickets/i).first()).toBeVisible({ timeout: 15000 });
  });

});
