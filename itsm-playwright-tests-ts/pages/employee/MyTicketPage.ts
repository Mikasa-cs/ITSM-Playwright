import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class MyTicketPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openFirstTicket() {
    await this.page.locator('[data-testid="ticket-row"], tr, .ticket-card').first().click();
  }

  async backToQueue() {
    await this.click('Back to Queue');
  }
}
