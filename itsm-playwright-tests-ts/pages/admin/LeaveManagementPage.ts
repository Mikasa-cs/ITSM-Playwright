import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class LeaveManagementPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.clickNav('Leave Management');
  }

  async filterBy(tab: 'Pending First' | 'Approved' | 'Rejected' | 'All Requests') {
    await this.click(tab);
  }

  async approveFirstPending() {
    await this.page.getByText(/pending/i).first().locator('..').getByRole('button', { name: /approve/i }).click();
  }

  async rejectFirstPending() {
    await this.page.getByText(/pending/i).first().locator('..').getByRole('button', { name: /reject/i }).click();
  }
}
