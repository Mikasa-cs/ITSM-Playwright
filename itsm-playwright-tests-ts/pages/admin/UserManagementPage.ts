import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class UserManagementPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.clickNav('User Management');
  }

  async openTab(tab: 'Pending Approval' | 'Active Users' | 'Inactive Users' | 'All Users') {
    await this.click(tab);
  }

  async search(term: string) {
    await this.page.getByPlaceholder(/search/i).fill(term);
  }

  async toggleShowDeleted() {
    await this.check('Show Deleted');
  }

  async rowFor(userNameOrEmail: string) {
    return this.page.getByText(userNameOrEmail, { exact: false }).locator('xpath=ancestor::tr[1]');
  }

  async openEditFor(userNameOrEmail: string) {
    const row = await this.rowFor(userNameOrEmail);
    await row.getByRole('button', { name: /edit/i }).click();
  }

  async openDeleteFor(userNameOrEmail: string) {
    const row = await this.rowFor(userNameOrEmail);
    await row.getByRole('button', { name: /delete/i }).click();
  }

  async openRoleChangeFor(userNameOrEmail: string) {
    const row = await this.rowFor(userNameOrEmail);
    await row.getByRole('button', { name: /role/i }).click();
  }
}
