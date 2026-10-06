// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');

test.describe('Admin - User Management', () => {

  test('Admin can navigate to User Management and process pending requests', async ({
    adminPage,
    adminDashboardPage,
  }) => {
    // Navigate and process any pending user requests (approve/reject if present)
    const result = await adminDashboardPage.processUserManagementRequests();

    // Verify the page is visible regardless of whether there were pending requests
    await expect(
      adminPage.getByRole('heading', { name: /user management/i })
        .or(adminPage.getByText(/user management/i).first())
    ).toBeVisible({ timeout: 15000 });

    if (result.processed > 0) {
      console.log(`[User Mgmt Test] Processed ${result.processed} pending user request(s).`);
    } else {
      console.log('[User Mgmt Test] No pending user requests found — page verified as empty.');
    }
  });

});
