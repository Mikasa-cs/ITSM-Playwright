const base = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');
const AdminDashboardPage = require('../pages/AdminDashboardPage');
const TicketQueuePage = require('../pages/TicketQueuePage');
const AIHelpdeskPage = require('../pages/AIHelpdeskPage');
const { KpiDashboardPage } = require('../pages/KpiDashboardPage');
const { KpiTicketPage } = require('../pages/KpiTicketPage');
const { CREDENTIALS } = require('../utils/auth');

/**
 * @typedef {Object} AdminFixtures
 * @property {LoginPage} loginPage
 * @property {AdminDashboardPage} adminDashboardPage
 * @property {TicketQueuePage} ticketQueuePage
 * @property {AIHelpdeskPage} aiHelpdeskPage
 * @property {KpiDashboardPage} kpiDashboardPage
 * @property {KpiTicketPage} kpiTicketPage
 * @property {import('@playwright/test').Page} adminPage
 */

/** @type {import('@playwright/test').TestType<AdminFixtures & import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions, import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions>} */
// @ts-ignore
const test = base.test.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  adminDashboardPage: async ({ page }, use) => {
    await use(new AdminDashboardPage(page));
  },
  ticketQueuePage: async ({ page }, use) => {
    await use(new TicketQueuePage(page));
  },
  aiHelpdeskPage: async ({ page }, use) => {
    await use(new AIHelpdeskPage(page));
  },
  kpiDashboardPage: async ({ page }, use) => {
    await use(new KpiDashboardPage(page));
  },
  kpiTicketPage: async ({ page }, use) => {
    await use(new KpiTicketPage(page));
  },
  // Authenticated admin page fixture
  adminPage: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
    await use(page);
  },
});

module.exports = {
  test,
  expect: base.expect,
};
