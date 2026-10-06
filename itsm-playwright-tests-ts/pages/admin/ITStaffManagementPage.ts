import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class ITStaffManagementPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.clickNav('IT Staff Management');
  }
}
