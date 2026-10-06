// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

/**
 * ForgotPasswordPage
 * Handles the ITSM "Forgot password?" flow on the login page.
 */
class ForgotPasswordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Login page elements
    this.forgotPasswordLink = page
      .getByRole('link', { name: /forgot\s*password/i })
      .or(page.getByText(/forgot\s*password/i).first())
      .or(page.locator('a[href*="forgot"]').first());

    // Reset Access page elements
    this.emailInput = page
      .getByPlaceholder(/email|your email/i)
      .or(page.locator('input[type="email"]'))
      .first();

    this.sendResetLinkButton = page
      .getByRole('button', { name: /send\s*reset\s*link|send\s*link|reset/i })
      .or(page.getByText(/send\s*reset\s*link/i))
      .first();

    // Success confirmation (shown after submitting)
    this.successMessage = page
      .getByText(/reset link sent|email sent|check your email|link has been sent|sent successfully/i)
      .or(page.getByRole('alert').filter({ hasText: /sent|success/i }))
      .first();
  }

  /**
   * Navigate to the ITSM login page.
   */
  async goto() {
    await this.page.goto('/#/login');
    await this.page.waitForLoadState('domcontentloaded');
    await pause(this.page, 1000);
    console.log('[ForgotPassword] Navigated to ITSM login page.');
  }

  /**
   * Click the "Forgot password?" link on the login page.
   */
  async clickForgotPassword() {
    await expect(this.forgotPasswordLink).toBeVisible({ timeout: 15000 });
    await this.forgotPasswordLink.click();
    await this.page.waitForLoadState('domcontentloaded');
    await pause(this.page, 1000);
    console.log('[ForgotPassword] Clicked "Forgot password?" link.');
  }

  /**
   * Enter the email address into the Reset Access form.
   * @param {string} email
   */
  async enterEmail(email) {
    await expect(this.emailInput).toBeVisible({ timeout: 10000 });
    await this.emailInput.click();
    await this.emailInput.fill(email);
    await pause(this.page, 500);
    console.log(`[ForgotPassword] Entered email: ${email}`);
  }

  /**
   * Click "Send reset link" button.
   */
  async clickSendResetLink() {
    await expect(this.sendResetLinkButton).toBeVisible({ timeout: 10000 });
    await this.sendResetLinkButton.click();
    await pause(this.page, 2000);
    console.log('[ForgotPassword] Clicked "Send reset link" button.');
  }

  /**
   * Verify that a success message is displayed after submitting the reset request.
   */
  async verifySuccessMessage() {
    // Wait for any visible success indicator
    await expect(this.successMessage).toBeVisible({ timeout: 15000 });
    const msg = await this.successMessage.innerText().catch(() => '(success state visible)');
    console.log(`[ForgotPassword] SUCCESS - Reset link request confirmed: "${msg}"`);
  }
}

module.exports = ForgotPasswordPage;
