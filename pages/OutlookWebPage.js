// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

const OUTLOOK_URL = 'https://outlook.office365.com/mail/';

/**
 * OutlookWebPage
 * -----------------------------------------------------------------------
 * Handles Outlook Web (office365) inbox verification for the password
 * reset email. Opens in a new browser tab in the SAME Edge/Chrome instance
 * so that any existing logged-in Microsoft session is reused automatically.
 *
 * NOTE: This class is designed to be SELF-CONTAINED and DELETABLE.
 * If Outlook verification is not required, simply remove the steps that
 * instantiate or call this class from the test spec.
 * -----------------------------------------------------------------------
 */
class OutlookWebPage {
  /**
   * @param {import('@playwright/test').BrowserContext} context  - The Playwright browser context
   */
  constructor(context) {
    this.context = context;
    /** @type {import('@playwright/test').Page|null} */
    this.outlookPage = null;
  }

  /**
   * Open Outlook Web in a new tab within the existing browser context.
   * Reuses any logged-in Microsoft session already present in Edge/Chrome.
   * @returns {Promise<import('@playwright/test').Page>}
   */
  async openInNewTab() {
    console.log('[OutlookWeb] Opening Outlook Web in a new browser tab...');
    this.outlookPage = await this.context.newPage();
    await this.outlookPage.goto(OUTLOOK_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pause(this.outlookPage, 3000);
    console.log('[OutlookWeb] Navigated to Outlook Web.');
    return this.outlookPage;
  }

  /**
   * Verify we are on the Outlook inbox (signed-in state).
   * Logs a warning if Outlook asks for sign-in instead of showing the inbox.
   */
  async verifySignedIn() {
    const page = this.outlookPage;
    if (!page) throw new Error('[OutlookWeb] Page not initialized. Call openInNewTab() first.');

    const isSignInPage = await page.getByText(/sign in|microsoft account/i).isVisible({ timeout: 5000 }).catch(() => false);
    if (isSignInPage) {
      console.warn('[OutlookWeb] WARNING: Outlook is showing a sign-in page. The browser may not have an active session.');
      console.warn('[OutlookWeb] Please manually sign in to Outlook Web in Microsoft Edge and re-run the test.');
      throw new Error('[OutlookWeb] Not signed into Outlook Web. Please sign in via Microsoft Edge first.');
    }

    // Wait for inbox to be visible
    await expect(
      page.getByRole('main').or(page.locator('[aria-label*="Inbox"]')).or(page.locator('[aria-label*="Mail"]')).first()
    ).toBeVisible({ timeout: 20000 });

    console.log('[OutlookWeb] Signed in. Inbox is visible.');
  }

  /**
   * Search the inbox for the password reset email from Talent Talk / the ITSM system.
   * Polls for up to `timeoutMs` (default 60s) waiting for the email to arrive.
   *
   * @param {Object} [opts]
   * @param {string} [opts.subjectKeyword]   - Subject keyword to match (default: 'password')
   * @param {string} [opts.senderKeyword]    - Sender name/domain to match (default: 'talent')
   * @param {number} [opts.timeoutMs]        - Max wait time in ms (default: 60000)
   * @returns {Promise<import('@playwright/test').Locator>}  - The matched email row locator
   */
  async waitForResetEmail({ subjectKeyword = 'password', senderKeyword = 'talent', timeoutMs = 60000 } = {}) {
    const page = this.outlookPage;
    if (!page) throw new Error('[OutlookWeb] Page not initialized.');

    console.log(`[OutlookWeb] Waiting for reset email (subject: "${subjectKeyword}", sender: "${senderKeyword}")...`);

    const deadline = Date.now() + timeoutMs;
    let emailRow = null;

    while (Date.now() < deadline) {
      // Reload inbox to pick up new emails
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await pause(page, 3000);

      // Try to find the reset email row by subject or sender keyword
      const candidates = page.getByRole('option').or(page.locator('[role="listitem"]')).or(page.locator('tr'));

      const count = await candidates.count();
      for (let i = 0; i < Math.min(count, 30); i++) {
        const row = candidates.nth(i);
        const text = await row.innerText().catch(() => '');
        const textLower = text.toLowerCase();
        if (
          textLower.includes(subjectKeyword.toLowerCase()) ||
          textLower.includes(senderKeyword.toLowerCase())
        ) {
          emailRow = row;
          console.log(`[OutlookWeb] Found reset email row: "${text.slice(0, 80).trim()}"`);
          break;
        }
      }

      if (emailRow) break;

      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      console.log(`[OutlookWeb] Email not found yet. Waiting... (${remaining}s remaining)`);
      await pause(page, 5000);
    }

    if (!emailRow) {
      throw new Error(`[OutlookWeb] Reset email not found in inbox within ${timeoutMs / 1000}s. Subject keyword: "${subjectKeyword}"`);
    }

    return emailRow;
  }

  /**
   * Click on the reset email and verify it contains a password reset link.
   * @param {import('@playwright/test').Locator} emailRow  - The email row from waitForResetEmail()
   * @returns {Promise<string>} - The reset link URL found in the email body
   */
  async verifyResetLinkInEmail(emailRow) {
    const page = this.outlookPage;
    if (!page) throw new Error('[OutlookWeb] Page not initialized.');

    console.log('[OutlookWeb] Opening reset email to verify link...');
    await emailRow.click();
    await pause(page, 2000);

    // Look for any link in the email body that looks like a reset link
    const resetLink = page
      .locator('a[href*="reset"], a[href*="password"], a[href*="token"], a[href*="confirm"]')
      .or(page.getByRole('link', { name: /reset|click here|set.*password|confirm/i }))
      .first();

    const isLinkVisible = await resetLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (isLinkVisible) {
      const href = await resetLink.getAttribute('href').catch(() => '');
      console.log(`[OutlookWeb] Password reset link found: "${href}"`);
      return href || 'reset link present';
    }

    // Fallback: just verify the email body has password-related content
    const emailBody = page.locator('[role="document"]').or(page.locator('.allowTextSelection')).first();
    const bodyText = await emailBody.innerText().catch(() => '');
    const hasResetContent = /reset|password|click|link/i.test(bodyText);

    if (hasResetContent) {
      console.log('[OutlookWeb] Email body contains password reset content. ✓');
      return 'reset content present in email body';
    }

    throw new Error('[OutlookWeb] Password reset link not found in the email body.');
  }

  /**
   * Close the Outlook Web tab.
   */
  async closeTab() {
    if (this.outlookPage) {
      await this.outlookPage.close();
      this.outlookPage = null;
      console.log('[OutlookWeb] Outlook Web tab closed.');
    }
  }
}

module.exports = OutlookWebPage;
