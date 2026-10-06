// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');
const testData = require('../../test-data/ticket-data.json');

test.describe('Admin - Ticket Queue Management', () => {

  test('Admin can create tickets, resolve with reason, and post comments', async ({
    adminPage,
    adminDashboardPage,
    ticketQueuePage,
  }) => {
    // 1. Navigate to Ticket Queue
    await adminDashboardPage.goToTicketQueue();

    // 2. Create first ticket (Wi-Fi issue)
    await ticketQueuePage.createTicket({
      employeeSubstring: testData.knownEmployees.shivi,
      title: testData.tickets.wifiIssue.title,
      description: testData.tickets.wifiIssue.description,
      priority: testData.tickets.wifiIssue.priority,
    });

    // 3. Create second ticket (Printer issue with High impact)
    await ticketQueuePage.createTicket({
      employeeSubstring: testData.knownEmployees.employee77,
      title: testData.tickets.printerIssue.title,
      description: testData.tickets.printerIssue.description,
      priority: testData.tickets.printerIssue.priority,
    });

    // 4. Open a ticket from the queue list
    await ticketQueuePage.openTicket(0);

    // 5. Resolve ticket with required reason
    await ticketQueuePage.resolveTicket({
      reason: testData.resolutions.defaultReason,
      note: testData.resolutions.resolutionNote,
    });

    // 6. Return to queue, open another ticket, and post a response
    await ticketQueuePage.backToQueue();
    await ticketQueuePage.openTicket(1);
    await ticketQueuePage.postComment(testData.ticketComments.itStaffGreeting);
  });

});
