// @ts-check
const { expect } = require('@playwright/test');

/**
 * Global credentials loaded from environment variables with safe defaults.
 */
const CREDENTIALS = {
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@enterprise.com',
    password: process.env.ADMIN_PASSWORD || 'Password@123',
    roleName: 'System Administration'
  },
  itstaff: {
    email: process.env.ITSTAFF_EMAIL || 'agent@enterprise.com',
    password: process.env.ITSTAFF_PASSWORD || 'Password@123',
    roleName: 'IT Staff'
  },
  employee: {
    email: process.env.EMPLOYEE_EMAIL || 'employee@enterprise.com',
    password: process.env.EMPLOYEE_PASSWORD || 'Password@123',
    roleName: 'Employee'
  }
};

/**
 * Standard pause helper between UI interactions for headed observation.
 * @param {import('@playwright/test').Page} page
 * @param {number} ms
 */
async function pause(page, ms = 1000) {
  if (process.env.SLOW_MO) {
    await page.waitForTimeout(ms);
  }
}

/**
 * Select an option from a native <select> element, retrying if the option list
 * is still empty (e.g. while cold-starting backend APIs).
 * Matches by the option's visible label text (partial match).
 *
 * @param {import('@playwright/test').Locator} selectLocator
 * @param {string} labelSubstring
 * @param {{ maxAttempts?: number, waitMs?: number }} [options]
 */
async function selectNativeOption(selectLocator, labelSubstring, { maxAttempts = 6, waitMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Click to visually open the dropdown
    await selectLocator.click({ timeout: 5000 }).catch(() => {});

    const optionTexts = await selectLocator.locator('option').allTextContents().catch(() => []);
    const match = optionTexts.find((t) => t.toLowerCase().includes(labelSubstring.toLowerCase()));

    if (match) {
      await selectLocator.selectOption({ label: match });
      return match;
    }

    // Close dropdown and wait for the backend to populate options
    await selectLocator.page().keyboard.press('Escape').catch(() => {});
    await selectLocator.page().waitForTimeout(waitMs);
  }
  throw new Error(`Option containing "${labelSubstring}" never appeared after ${maxAttempts} attempts.`);
}

/**
 * Wait for dashboard UI or URL change after login, with automatic page reload retry
 * if cold-starting takes longer than expected.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
async function waitForDashboard(page, timeout = 60000) {
  /**
   * @param {number} t
   */
  const isDashboardVisible = async (t) => {
    return Promise.race([
      expect(page.getByText(/System Administration|Dashboard|Ticket Queue|Welcome/i).first()).toBeVisible({ timeout: t }),
      page.waitForURL(/dashboard|queue|home/i, { timeout: t })
    ]);
  };

  try {
    await isDashboardVisible(timeout);
  } catch {
    // Retry once with page reload to kick cold-start API
    await page.reload();
    await page.waitForLoadState('networkidle');
    await isDashboardVisible(timeout);
  }
}

module.exports = {
  CREDENTIALS,
  pause,
  selectNativeOption,
  waitForDashboard
};
