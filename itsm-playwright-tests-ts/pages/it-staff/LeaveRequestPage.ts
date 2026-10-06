import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class LeaveRequestPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async submitLeaveRequest(opts: { startDate: string; endDate: string; reason: string }) {
    await this.fillByLabel('Start Date', opts.startDate);
    await this.fillByLabel('End Date', opts.endDate);
    await this.fillByLabel('Reason', opts.reason);
    await this.click('Submit');
  }
}
