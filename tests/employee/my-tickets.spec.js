// @ts-check
const { test, expect } = require('../../fixtures/employee.fixture');
const testData = require('../../test-data/ticket-data.json');

test.describe('Employee - My Tickets', () => {

  test('Employee can view ticket history and interact with ticket', async ({
    employeePage,
    employeeDashboardPage,
    myTicketsPage,
  }) => {
    await employeeDashboardPage.goToMyTickets();
    await myTicketsPage.verifyTicketsVisible();

    await myTicketsPage.selectTicket(0);
    await myTicketsPage.replyToTicket(testData.ticketComments.employeeReply);
  });

});
