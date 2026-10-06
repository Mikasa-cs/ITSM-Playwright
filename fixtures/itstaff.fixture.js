const base = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');
const ITStaffDashboardPage = require('../pages/ITStaffDashboardPage');
const TicketQueuePage = require('../pages/TicketQueuePage');
const AIHelpdeskPage = require('../pages/AIHelpdeskPage');
const { CREDENTIALS } = require('../utils/auth');

/**
 * @typedef {Object} ITStaffFixtures
 * @property {LoginPage} loginPage
 * @property {ITStaffDashboardPage} itStaffDashboardPage
 * @property {TicketQueuePage} ticketQueuePage
 * @property {AIHelpdeskPage} aiHelpdeskPage
 * @property {import('@playwright/test').Page} itStaffPage
 */

/** @type {import('@playwright/test').TestType<ITStaffFixtures & import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions, import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions>} */
// @ts-ignore
const test = base.test.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  itStaffDashboardPage: async ({ page }, use) => {
    await use(new ITStaffDashboardPage(page));
  },
  ticketQueuePage: async ({ page }, use) => {
    await use(new TicketQueuePage(page));
  },
  aiHelpdeskPage: async ({ page }, use) => {
    await use(new AIHelpdeskPage(page));
  },
  // Authenticated IT Staff page fixture
  itStaffPage: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDENTIALS.itstaff.email, CREDENTIALS.itstaff.password);
    await use(page);
  },
});

module.exports = {
  test,
  expect: base.expect,
};
