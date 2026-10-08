// @ts-check
const { test, expect } = require('../../fixtures/itstaff.fixture');

test.describe('IT Staff - Alert Center', () => {

  test('IT Staff can navigate to Alert Center and view agent alerts', async ({
    itStaffPage,
  }) => {
    const acNav = itStaffPage.getByRole('link', { name: /alert center/i })
      .or(itStaffPage.getByRole('button', { name: /alert center/i }))
      .or(itStaffPage.getByText(/alert center/i).first());
    await acNav.click();

    await expect(
      itStaffPage.getByRole('heading', { name: /alert center|agent alerts/i })
        .or(itStaffPage.getByText(/alert center|agent alerts/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

});
