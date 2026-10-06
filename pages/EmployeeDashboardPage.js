// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

class EmployeeDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.navDashboard = page.getByRole('link', { name: /dashboard|home/i }).or(page.getByRole('button', { name: /dashboard|home/i }));
    this.navMyTickets = page.getByRole('link', { name: /my tickets/i }).or(page.getByRole('button', { name: /my tickets/i }));
    this.navAIHelpdesk = page.getByRole('link', { name: /ai helpdesk/i }).or(page.getByRole('button', { name: /ai helpdesk/i }));
    this.newRequestBtn = page.getByRole('button', { name: /new (ticket|request|support)/i });
  }

  async verifyDashboardLoaded() {
    await expect(
      this.page.getByText(/Welcome|Employee Portal|Support Portal|My Tickets|Quick Actions/i).first()
    ).toBeVisible({ timeout: 15000 });
  }

  async goToMyTickets() {
    await this.navMyTickets.first().click();
    await pause(this.page);
  }

  async goToAIHelpdesk() {
    await this.navAIHelpdesk.first().click();
    await pause(this.page);
  }

  async openNewRequest() {
    if (await this.newRequestBtn.first().isVisible().catch(() => false)) {
      await this.newRequestBtn.first().click();
      await pause(this.page);
    }
  }
}

module.exports = EmployeeDashboardPage;
