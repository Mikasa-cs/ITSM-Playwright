import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class AlertManagementPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.clickNav('Alert Management');
  }

  async createAlert(opts: { title: string; category?: string; message: string; employees?: boolean; itStaff?: boolean }) {
    await this.fillByLabel('Title', opts.title);
    if (opts.category) await this.fillByLabel('Category', opts.category);
    await this.fillByLabel('Message', opts.message);
    if (opts.employees) await this.check('Employees');
    if (opts.itStaff) await this.check('IT Staff');
    await this.click('Send System Alert');
  }

  async openManualAlerts() {
    await this.click('Manual Alerts');
  }

  async openAutomaticAlerts() {
    await this.click('Automatic Alerts');
  }

  async filterByStatus(status: string) {
    await this.selectOption('Status', status);
  }

  async clearHistory() {
    await this.click('Clear History');
  }
}
