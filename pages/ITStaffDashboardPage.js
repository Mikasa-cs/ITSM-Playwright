// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

class ITStaffDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.navDashboard = page.getByRole('link', { name: /dashboard/i }).or(page.getByRole('button', { name: /dashboard/i }));
    this.navTicketQueue = page.getByRole('link', { name: /ticket queue/i }).or(page.getByRole('button', { name: /ticket queue/i }));
    this.navAIHelpdesk = page.getByRole('link', { name: /ai helpdesk/i }).or(page.getByRole('button', { name: /ai helpdesk/i }));
  }

  async verifyDashboardLoaded() {
    await expect(
      this.page.getByText(/IT Staff|Dashboard|Ticket Queue|Assigned/i).first()
    ).toBeVisible({ timeout: 15000 });
  }

  async goToTicketQueue() {
    await this.navTicketQueue.first().click();
    await expect(
      this.page.getByRole('heading', { name: /ticket queue/i })
        .or(this.page.getByText(/ticket queue/i).first())
    ).toBeVisible({ timeout: 10000 });
    await pause(this.page);
  }

  async goToAIHelpdesk() {
    await this.navAIHelpdesk.first().click();
    await pause(this.page);
  }
}

module.exports = ITStaffDashboardPage;
