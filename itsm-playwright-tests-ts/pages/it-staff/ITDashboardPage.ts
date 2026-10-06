import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class ITDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async clickNewTicket() {
    await this.click('New Ticket');
  }

  async clickAICopilot() {
    await this.click('AI Copilot');
  }
}
