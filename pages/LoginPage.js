// @ts-check
const { expect } = require('@playwright/test');
const { waitForDashboard, pause } = require('../utils/auth');

class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.emailInput = page.getByPlaceholder(/name@company\.com/i)
      .or(page.locator('input[type="email"]'))
      .first();
    this.passwordInput = page.locator('#login-password')
      .or(page.locator('input[type="password"]'))
      .first();
    this.signInButton = page.getByRole('button', { name: /sign in/i }).first();
    this.loginError = page.getByText(/invalid|incorrect|failed|error/i).first();
  }

  async goto() {
    await this.page.goto('/#/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Perform user login.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    await expect(this.emailInput).toBeVisible({ timeout: 15000 });
    await this.emailInput.fill(email);
    await pause(this.page, 300);

    await expect(this.passwordInput).toBeVisible({ timeout: 5000 });
    await this.passwordInput.fill(password);
    await pause(this.page, 300);

    await this.signInButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});

    // Check for explicit rejection
    if (await this.loginError.isVisible().catch(() => false)) {
      const msg = await this.loginError.innerText();
      throw new Error(`Login rejected with message: "${msg}"`);
    }

    await waitForDashboard(this.page);
  }
}

module.exports = LoginPage;
