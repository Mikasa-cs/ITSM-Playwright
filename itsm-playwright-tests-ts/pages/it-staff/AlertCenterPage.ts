import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class AlertCenterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async refresh() {
    await this.click('Refresh Alerts');
  }

  async openManualAlerts() {
    await this.click('Manual Alerts');
  }

  async openAutomaticAlerts() {
    await this.click('Automatic Alerts');
  }
}
