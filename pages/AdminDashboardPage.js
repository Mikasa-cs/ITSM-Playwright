// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');
const { generateAlert } = require('../utils/llm-alerts');

class AdminDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Navigation Links/Buttons
    this.navDashboard = page.getByRole('link', { name: /dashboard/i }).or(page.getByRole('button', { name: /dashboard/i }));
    this.navTicketQueue = page.getByRole('link', { name: /ticket queue/i }).or(page.getByRole('button', { name: /ticket queue/i }));
    this.navAlertManagement = page.getByRole('link', { name: /alert management/i }).or(page.getByRole('button', { name: /alert management/i }));
    this.navLeaveManagement = page.getByRole('link', { name: /leave management/i }).or(page.getByRole('button', { name: /leave management/i }));
    this.navUserManagement = page.getByRole('link', { name: /user management/i }).or(page.getByRole('button', { name: /user management/i }));
    this.navSettings = page.getByRole('link', { name: /settings/i }).or(page.getByRole('button', { name: /settings/i }));
    this.navAIHelpdesk = page.getByRole('link', { name: /ai helpdesk/i }).or(page.getByRole('button', { name: /ai helpdesk/i }));

    // Alert Management elements
    this.alertTitleInput = page.getByPlaceholder(/e\.g\. Email Gateway Connection Issues/i);
    this.alertMessageInput = page.getByPlaceholder(/Describe the issue, workarounds/i);
    this.employeesCheckbox = page.getByRole('checkbox', { name: /employees/i }).or(page.getByLabel(/employees/i));
    this.itStaffCheckbox = page.getByRole('checkbox', { name: /it staff/i }).or(page.getByLabel(/it staff/i));
    this.sendAlertButton = page.getByRole('button', { name: /send system alert/i });
  }

  async openAlertManagement() {
    await this.navAlertManagement.first().click();
    await expect(this.page.getByRole('heading', { name: 'Alert Management' })).toBeVisible({ timeout: 10000 });
    await pause(this.page);
  }

  /**
   * Broadcast a system-wide alert.
   * @param {{ title: string, message: string, targetEmployees?: boolean, targetITStaff?: boolean }} alertData
   */
  async sendSystemAlert({ title, message, targetEmployees = true, targetITStaff = true }) {
    await this.openAlertManagement();

    await this.alertTitleInput.pressSequentially(title, { delay: 60 });
    await this.alertMessageInput.pressSequentially(message, { delay: 50 });
    await pause(this.page);

    if (targetEmployees && !(await this.employeesCheckbox.isChecked())) {
      await this.employeesCheckbox.check();
    }
    if (targetITStaff && !(await this.itStaffCheckbox.isChecked())) {
      await this.itStaffCheckbox.check();
    }
    await pause(this.page);

    await this.sendAlertButton.click();
    await expect(this.page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await pause(this.page);
  }

  async goToTicketQueue() {
    await this.navTicketQueue.first().click();
    await expect(this.page.getByRole('heading', { name: /ticket queue/i }).or(this.page.getByText(/ticket queue/i).first())).toBeVisible({ timeout: 10000 });
    await pause(this.page);
  }

  /**
   * Generate a dynamic AI alert via LLM and broadcast it as a system-wide alert.
   * @param {Object} [opts]
   * @param {string[]} [opts.systemContext]  - Keywords/events to contextualize the alert
   * @param {boolean}  [opts.targetEmployees]
   * @param {boolean}  [opts.targetITStaff]
   * @returns {Promise<{title: string, message: string}>}
   */
  async generateAndSendAIAlert({ systemContext = [], targetEmployees = true, targetITStaff = true } = {}) {
    console.log('[AdminDashboard] Generating AI-powered system alert...');
    const alert = await generateAlert({ systemContext, audience: 'all users' });
    console.log(`[AdminDashboard] AI Alert — title: "${alert.title}"`);

    await this.sendSystemAlert({
      title: alert.title,
      message: alert.message,
      targetEmployees,
      targetITStaff,
    });

    return alert;
  }

  async goToLeaveManagement() {
    await this.navLeaveManagement.first().click();
    await expect(this.page.getByRole('heading', { name: /leave management/i }).or(this.page.getByText(/leave management/i).first())).toBeVisible({ timeout: 10000 });
  }

  /**
   * Navigate to Leave Management and process any pending leave requests.
   * Approves or rejects them if found. Does nothing if the list is empty.
   * @returns {Promise<{processed: number, action: string}>}
   */
  async processLeaveManagementRequests() {
    await this.goToLeaveManagement();
    await pause(this.page, 2000);

    // Look for pending leave request rows/cards (approve/reject buttons indicate a pending item)
    const approveBtns = this.page.getByRole('button', { name: /approve/i });
    const rejectBtns  = this.page.getByRole('button', { name: /reject/i });

    const approveCount = await approveBtns.count();

    if (approveCount === 0) {
      console.log('[AdminDashboard] Leave Management: No pending requests found. Page unchanged.');
      return { processed: 0, action: 'none' };
    }

    console.log(`[AdminDashboard] Leave Management: Found ${approveCount} pending request(s). Processing...`);
    let processed = 0;

    // Process up to all pending requests
    for (let i = 0; i < approveCount; i++) {
      // Re-query after each action because the DOM may update
      const currentApprove = this.page.getByRole('button', { name: /approve/i }).first();
      const currentReject  = this.page.getByRole('button', { name: /reject/i }).first();

      const isVisible = await currentApprove.isVisible().catch(() => false);
      if (!isVisible) break;

      // Approve the first, reject the second — alternating for realism
      if (i % 2 === 0) {
        console.log(`[AdminDashboard] Leave Management: Approving request ${i + 1}`);
        await currentApprove.click();
      } else {
        const rejectVisible = await currentReject.isVisible().catch(() => false);
        if (rejectVisible) {
          console.log(`[AdminDashboard] Leave Management: Rejecting request ${i + 1}`);
          await currentReject.click();
        } else {
          await currentApprove.click();
        }
      }

      await pause(this.page, 1500);
      processed++;
    }

    console.log(`[AdminDashboard] Leave Management: Processed ${processed} request(s).`);
    return { processed, action: 'approve_reject' };
  }

  async goToUserManagement() {
    await this.navUserManagement.first().click();
    await expect(this.page.getByRole('heading', { name: /user management/i }).or(this.page.getByText(/user management/i).first())).toBeVisible({ timeout: 10000 });
  }

  /**
   * Navigate to User Management and process any pending user registration/access requests.
   * Accepts or rejects them if found. Does nothing if the list is empty.
   * @returns {Promise<{processed: number, action: string}>}
   */
  async processUserManagementRequests() {
    await this.goToUserManagement();
    await pause(this.page, 2000);

    // Pending user requests typically have approve/accept/reject/deny buttons
    const approveBtns = this.page
      .getByRole('button', { name: /approve|accept/i })
      .or(this.page.getByRole('button', { name: /activate/i }));
    const rejectBtns = this.page
      .getByRole('button', { name: /reject|deny|deactivate/i });

    const approveCount = await approveBtns.count();

    if (approveCount === 0) {
      console.log('[AdminDashboard] User Management: No pending requests found. Page unchanged.');
      return { processed: 0, action: 'none' };
    }

    console.log(`[AdminDashboard] User Management: Found ${approveCount} pending request(s). Processing...`);
    let processed = 0;

    for (let i = 0; i < approveCount; i++) {
      const currentApprove = approveBtns.first();
      const isVisible = await currentApprove.isVisible().catch(() => false);
      if (!isVisible) break;

      if (i % 2 === 0) {
        console.log(`[AdminDashboard] User Management: Approving/accepting request ${i + 1}`);
        await currentApprove.click();
      } else {
        const rejectBtn = rejectBtns.first();
        const rejectVisible = await rejectBtn.isVisible().catch(() => false);
        if (rejectVisible) {
          console.log(`[AdminDashboard] User Management: Rejecting request ${i + 1}`);
          await rejectBtn.click();
        } else {
          await currentApprove.click();
        }
      }

      await pause(this.page, 1500);
      processed++;
    }

    console.log(`[AdminDashboard] User Management: Processed ${processed} request(s).`);
    return { processed, action: 'approve_reject' };
  }

  async goToSettings() {
    await this.navSettings.first().click();
    await expect(this.page.getByRole('heading', { name: /settings/i }).or(this.page.getByText(/settings/i).first())).toBeVisible({ timeout: 10000 });
  }

  async goToAIHelpdesk() {
    await this.navAIHelpdesk.first().click();
    await pause(this.page);
  }
}

module.exports = AdminDashboardPage;