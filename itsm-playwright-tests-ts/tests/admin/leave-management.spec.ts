import { test, expect } from '../../fixtures/roles.fixture';
import { BasePage } from '../../pages/common/BasePage';

test.describe('Leave Management (Admin)', () => {
  test('[LM- 01] Verify Leave Management page loads successfully', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Login as Admin.', async () => {
    // Handled by the '{project}' storageState fixture: Login as Admin.
    });
    await test.step('Click Leave Management from the sidebar.', async () => {
    await base.click('Leave Management from the sidebar');
    await base.expectVisible('Leave Management page opens successfully and leave requests');
    });
  });

  test('[LM- 02] Verify leave request information is displayed', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Leave Management.', async () => {
    // TODO: Open Leave Management.
    });
    await test.step('Inspect the request list.', async () => {
    // TODO: Inspect the request list.
    await base.expectVisible('IT Staff, Requested date, Dates, Reason and Status');
    });
  });

  test('[LM- 03] Verify Pending First filter', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click Pending First', async () => {
    await base.click('Pending First');
    await base.expectVisible('Pending leave requests');
    });
  });

  test('[LM- 04] Verify Approved filter', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click Approved.', async () => {
    await base.click('Approved');
    await base.expectVisible('Only approved leave requests');
    });
  });

  test('[LM- 05] Verify Rejected filter', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click Rejected.', async () => {
    await base.click('Rejected');
    await base.expectVisible('Only rejected leave requests');
    });
  });

  test('[LM- 06] Verify All Requests filter', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click All Requests.', async () => {
    await base.click('All Requests');
    await base.expectVisible('All available leave requests');
    });
  });

  test('[LM- 07] Approve a pending leave request', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Locate a request with Pending status.', async () => {
    // TODO: Locate a request with Pending status.
    });
    await test.step('Click Approve', async () => {
    await base.click('Approve');
    // Expected: Leave request status changes to Approved and the updated status is reflected in the list.
    });
  });

  test('[LM- 08] Reject a pending leave request', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Locate a request with Pending status.', async () => {
    // TODO: Locate a request with Pending status.
    });
    await test.step('Click Reject.', async () => {
    await base.click('Reject');
    // Expected: Leave request status changes to Rejected and the updated status is reflected in the list.
    });
  });

  test('[LM- 09] Verify approved request cannot be approved again', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Filter/select Approved requests.', async () => {
    // TODO: Filter/select Approved requests.
    });
    await test.step('Inspect actions.', async () => {
    // TODO: Inspect actions.
    // Expected: Approve action is unavailable/disabled for an already approved request, according to business rules.
    });
  });

  test('[LM- 10] Verify rejected request cannot be rejected again', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Filter/select Rejected requests.', async () => {
    // TODO: Filter/select Rejected requests.
    });
    await test.step('Inspect actions.', async () => {
    // TODO: Inspect actions.
    // Expected: Reject action is unavailable/disabled for an already rejected request, according to business rules.
    });
  });

  test('[LM- 11] Verify refresh updates leave request data', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Change a pending request to Approved or Rejected.', async () => {
    // TODO: Change a pending request to Approved or Rejected.
    });
    await test.step('Refresh the page.', async () => {
    // TODO: Refresh the page.
    await base.reload();
    // TODO: re-assert -> Updated leave status persists after refresh.
    });
  });

  test('[LM- 12] Verify leave request date and status consistency', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Leave Management.', async () => {
    // TODO: Open Leave Management.
    });
    await test.step('Inspect each displayed request.', async () => {
    // TODO: Inspect each displayed request.
    // Expected: Dates and status shown for each request correspond to the actual leave request data.
    });
  });

});
