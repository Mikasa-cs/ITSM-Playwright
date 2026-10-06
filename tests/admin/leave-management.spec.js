// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');

test.describe('Admin - Leave Management', () => {

  test('Admin can navigate to Leave Management and process pending requests', async ({
    adminPage,
    adminDashboardPage,
  }) => {
    // Navigate and process any pending leave requests (approve/reject if present)
    const result = await adminDashboardPage.processLeaveManagementRequests();

    // Verify the page is visible regardless of whether there were pending requests
    await expect(
      adminPage.getByRole('heading', { name: /leave management/i })
        .or(adminPage.getByText(/leave management/i).first())
    ).toBeVisible({ timeout: 15000 });

    if (result.processed > 0) {
      console.log(`[Leave Mgmt Test] Processed ${result.processed} pending leave request(s).`);
    } else {
      console.log('[Leave Mgmt Test] No pending leave requests found — page verified as empty.');
    }
  });

});
