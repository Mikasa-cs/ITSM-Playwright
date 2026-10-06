// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');

test.describe('Admin - Type 2: Alert Management — AI-Generated Alerts', () => {

  test('Admin can broadcast an AI-generated system alert to all users', async ({
    adminPage,
    adminDashboardPage,
  }) => {
    // LLM generates a relevant, dynamic alert based on system context
    const generatedAlert = await adminDashboardPage.generateAndSendAIAlert({
      systemContext: ['high ticket volume', 'VPN issues reported', 'password expiry upcoming'],
      targetEmployees: true,
      targetITStaff: true,
    });

    // Verify the AI-generated title appears on screen after sending
    await expect(
      adminPage.getByText(generatedAlert.title, { exact: true }).first()
    ).toBeVisible({ timeout: 10000 });

    console.log(`[Alert Test] AI alert sent and verified: "${generatedAlert.title}"`);
  });

});
