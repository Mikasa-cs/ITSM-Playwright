// @ts-check
const { test, expect } = require('../../fixtures/itstaff.fixture');

test.describe('IT Staff - Leave Request / Leave Calendar', () => {

  test('IT Staff can navigate to Leave Calendar and view leave requests', async ({
    itStaffPage,
  }) => {
    const lrNav = itStaffPage.getByRole('link', { name: /leave calendar|leave request/i })
      .or(itStaffPage.getByRole('button', { name: /leave calendar|leave request/i }))
      .or(itStaffPage.getByText(/leave calendar|leave request/i).first());
    await lrNav.click();

    await expect(
      itStaffPage.getByRole('heading', { name: /leave calendar|agent leave requests|leave request/i })
        .or(itStaffPage.getByText(/leave calendar|agent leave requests|leave request/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

});
