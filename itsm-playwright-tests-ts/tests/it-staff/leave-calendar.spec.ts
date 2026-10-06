import { test, expect } from '../../fixtures/roles.fixture';
import { BasePage } from '../../pages/common/BasePage';

test.describe('IT Staff - Leave Calendar', () => {
  test('[LC-01] Verify Leave Calendar page loads successfully', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Login as IT Staff.', async () => {
    // Handled by the '{project}' storageState fixture: Login as IT Staff.
    });
    await test.step('Click Leave Calendar.', async () => {
    await base.click('Leave Calendar');
    // Expected: Agent Leave Requests page loads successfully without errors.
    });
  });

});
