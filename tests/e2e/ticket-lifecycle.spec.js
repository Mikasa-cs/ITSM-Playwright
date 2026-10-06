// @ts-check
const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AdminDashboardPage = require('../../pages/AdminDashboardPage');
const TicketQueuePage = require('../../pages/TicketQueuePage');
const { CREDENTIALS } = require('../../utils/auth');
const testData = require('../../test-data/ticket-data.json');

test.describe('E2E - Ticket Lifecycle Flow', () => {

  test('Complete flow: Admin broadcasts alert -> creates ticket -> updates comment -> resolves with reason', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const loginPage = new LoginPage(page);
    const adminDashboard = new AdminDashboardPage(page);
    const ticketQueue = new TicketQueuePage(page);

    // 1. Log in as Admin
    await loginPage.goto();
    await loginPage.login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // 2. Broadcast System Alert
    await adminDashboard.sendSystemAlert({
      title: testData.systemAlert.title,
      message: testData.systemAlert.message,
      targetEmployees: true,
      targetITStaff: true,
    });

    // 3. Navigate to Ticket Queue & Create Support Ticket
    await adminDashboard.goToTicketQueue();
    await ticketQueue.createTicket({
      employeeSubstring: testData.knownEmployees.shivi,
      title: testData.tickets.wifiIssue.title,
      description: testData.tickets.wifiIssue.description,
      priority: testData.tickets.wifiIssue.priority,
    });

    // 4. Open the created ticket
    await ticketQueue.openTicket(0);

    // 5. Post response/comment
    await ticketQueue.postComment(testData.ticketComments.itStaffGreeting);

    // 6. Resolve ticket with reason
    await ticketQueue.resolveTicket({
      reason: testData.resolutions.defaultReason,
      note: testData.resolutions.resolutionNote,
    });

    // 7. Verify back in queue
    await expect(page.getByText(/ticket queue/i).first()).toBeVisible({ timeout: 10000 });
  });

});
