import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class TicketQueuePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async clickNewSupportTicket() {
    await this.click('New Support Ticket');
  }

  async openFirstTicket() {
    await this.page.locator('[data-testid="ticket-row"], tr, .ticket-card').first().click();
  }
}
