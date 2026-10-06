// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

class MyTicketsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.ticketList = page.locator('table tbody tr').or(page.getByText(/INC-2026/));
    this.commentInput = page.locator('#ticket-comment')
      .or(page.getByPlaceholder(/type.*message|write a message/i));
    this.sendCommentBtn = page.getByRole('button', { name: /send/i });
  }

  async verifyTicketsVisible() {
    await expect(
      this.page.getByRole('heading', { name: /my tickets/i })
        .or(this.page.getByText(/my tickets/i).first())
    ).toBeVisible({ timeout: 15000 });
  }

  async selectTicket(index = 0) {
    const tickets = this.page.getByText(/INC-2026/);
    if (await tickets.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await tickets.nth(index).click();
      await pause(this.page);
    }
  }

  /**
   * Add a response comment to the ticket.
   * @param {string} message
   */
  async replyToTicket(message) {
    if (await this.commentInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.commentInput.first().fill(message);
      if (await this.sendCommentBtn.first().isVisible().catch(() => false)) {
        await this.sendCommentBtn.first().click();
      } else {
        await this.page.keyboard.press('Enter');
      }
      await pause(this.page);
    }
  }
}

module.exports = MyTicketsPage;
