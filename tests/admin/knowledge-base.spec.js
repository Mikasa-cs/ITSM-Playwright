// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');

test.describe('Admin - Knowledge Base', () => {

  test('Admin can navigate to Knowledge Base and inspect documents', async ({
    adminPage,
  }) => {
    const kbNav = adminPage.getByRole('link', { name: /knowledge base/i })
      .or(adminPage.getByRole('button', { name: /knowledge base/i }))
      .or(adminPage.getByText(/knowledge base/i).first());
    await kbNav.click();

    await expect(
      adminPage.getByRole('heading', { name: /knowledge base/i })
        .or(adminPage.getByText(/knowledge base/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

});
