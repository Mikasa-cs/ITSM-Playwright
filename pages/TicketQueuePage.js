// @ts-check
const { expect } = require('@playwright/test');
const { pause, selectNativeOption } = require('../utils/auth');

class TicketQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Ticket list and modal triggers
    this.newSupportTicketBtn = page.getByRole('button', { name: /new support ticket/i });
    this.modalEmployeeSelect = page.locator('form select').first()
      .or(page.locator('div:has(> label:has-text("Employee")) select'));
    this.ticketTitleInput = page.locator('#new-ticket-title')
      .or(page.getByPlaceholder(/corporate wi-fi|issue headline/i))
      .or(page.locator('input[name="title"]'));
    this.ticketDescInput = page.locator('#new-ticket-description')
      .or(page.getByPlaceholder(/technical description|troubleshooting steps/i))
      .or(page.locator('textarea[name="description"]'));
    this.createTicketBtn = page.getByRole('button', { name: /create ticket/i });

    // Ticket resolution controls
    this.resolveCloseBtn = page.getByRole('button', { name: /resolve|close ticket/i });
    this.resolutionNoteInput = page.locator('#ticket-resolution')
      .or(page.getByPlaceholder(/describe how/i));
    this.actionReasonInput = page.locator('#ticket-action-reason')
      .or(page.getByPlaceholder(/enter reason for resolve/i))
      .or(page.locator('textarea[name="reason"]'));
    this.confirmActionBtn = page.getByRole('button', { name: /confirm/i });

    // Ticket comment controls
    this.commentInput = page.locator('#ticket-comment')
      .or(page.getByPlaceholder(/type.*message|write a message|post a response/i));
    this.sendCommentBtn = page.getByRole('button', { name: /send/i });
    this.backToQueueBtn = page.getByRole('button', { name: /back/i })
      .or(page.getByText(/back to queue/i))
      .or(page.locator('button:has-text("Back")'));
  }

  async openNewTicketModal() {
    await this.newSupportTicketBtn.click();
    await expect(
      this.page.getByText(/file support request/i).or(this.page.getByLabel(/employee/i))
    ).toBeVisible({ timeout: 10000 });
    await pause(this.page);
  }

  /**
   * Create a new support ticket.
   * @param {{ employeeSubstring: string, title: string, description: string, priority?: string }} params
   */
  async createTicket({ employeeSubstring, title, description, priority = 'Medium' }) {
    await this.openNewTicketModal();

    await selectNativeOption(this.modalEmployeeSelect, employeeSubstring);
    await pause(this.page);

    await this.ticketTitleInput.pressSequentially(title, { delay: 60 });
    await pause(this.page);

    await this.ticketDescInput.pressSequentially(description, { delay: 40 });
    await pause(this.page);

    if (priority && priority.toLowerCase() !== 'medium') {
      const priorityBtn = this.page.getByRole('button', { name: new RegExp(priority, 'i') });
      if (await priorityBtn.isVisible().catch(() => false)) {
        await priorityBtn.click();
        await pause(this.page);
      }
    }

    await this.createTicketBtn.click();
    await pause(this.page, 1500);
  }

  /**
   * Click on a ticket in the queue list.
   * @param {number|RegExp|string} [identifier]
   */
  async openTicket(identifier = 0) {
    if (typeof identifier === 'number') {
      const tickets = this.page.getByText(/INC-2026/);
      await expect(tickets.first()).toBeVisible({ timeout: 15000 });
      await tickets.nth(identifier).click();
    } else {
      await this.page.getByText(identifier).first().click();
    }
    await pause(this.page);
  }

  /**
   * Resolve currently opened ticket.
   * @param {{ reason?: string, note?: string }} [resolutionData]
   */
  async resolveTicket({ reason = 'done', note = 'Issue resolved' } = {}) {
    await this.resolveCloseBtn.first().click();
    await pause(this.page);

    if (await this.resolutionNoteInput.first().isVisible().catch(() => false)) {
      await this.resolutionNoteInput.first().fill(note);
    }

    await expect(this.actionReasonInput.first()).toBeVisible({ timeout: 5000 });
    await this.actionReasonInput.first().pressSequentially(reason, { delay: 60 });
    await pause(this.page);

    await expect(this.confirmActionBtn.first()).toBeEnabled({ timeout: 10000 });
    await this.confirmActionBtn.first().click();
    await pause(this.page);
  }

  /**
   * Post a reply / comment on the currently opened ticket.
   * @param {string} message
   */
  async postComment(message) {
    await expect(this.commentInput.first()).toBeVisible({ timeout: 10000 });
    await this.commentInput.first().pressSequentially(message, { delay: 50 });
    await pause(this.page);

    if (await this.sendCommentBtn.first().isVisible().catch(() => false)) {
      await this.sendCommentBtn.first().click();
    } else {
      await this.page.keyboard.press('Enter');
    }
    await pause(this.page);
  }

  async backToQueue() {
    await this.backToQueueBtn.first().click();
    await pause(this.page);
  }
}

module.exports = TicketQueuePage;
