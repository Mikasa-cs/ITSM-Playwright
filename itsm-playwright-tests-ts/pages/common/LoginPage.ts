import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { BASE_URL } from '../../config/env';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async login(userId: string, password: string) {
    await this.page.getByLabel(/user\s*id|email/i).fill(userId);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole('button', { name: /submit|log ?in|sign ?in/i }).click();
  }

  async expectLoginFailed() {
    // TODO: replace with the app's actual error state/message once confirmed
    await expect(this.page).toHaveURL(BASE_URL + '/');
  }

  async expectNavigatedToDashboard() {
    await expect(this.page).not.toHaveURL(BASE_URL + '/');
  }
}
