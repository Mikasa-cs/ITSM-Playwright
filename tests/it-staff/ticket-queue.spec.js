// @ts-check
const { test, expect } = require('../../fixtures/itstaff.fixture');
const testData = require('../../test-data/ticket-data.json');

test.describe('IT Staff - Ticket Queue', () => {

  test('IT Staff can access ticket queue and post a comment on an active ticket', async ({
    itStaffPage,
    itStaffDashboardPage,
    ticketQueuePage,
  }) => {
    await itStaffDashboardPage.goToTicketQueue();
    await expect(itStaffPage.getByRole('heading', { name: /ticket queue/i }).or(itStaffPage.getByText(/ticket queue/i).first())).toBeVisible({ timeout: 15000 });

    // Open first ticket if present
    await ticketQueuePage.openTicket(0);
    await ticketQueuePage.postComment(testData.ticketComments.itStaffGreeting);
  });

});
