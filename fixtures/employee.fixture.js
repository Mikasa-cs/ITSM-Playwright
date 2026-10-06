const base = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');
const EmployeeDashboardPage = require('../pages/EmployeeDashboardPage');
const MyTicketsPage = require('../pages/MyTicketsPage');
const AIHelpdeskPage = require('../pages/AIHelpdeskPage');
const { CREDENTIALS } = require('../utils/auth');

/**
 * @typedef {Object} EmployeeFixtures
 * @property {LoginPage} loginPage
 * @property {EmployeeDashboardPage} employeeDashboardPage
 * @property {MyTicketsPage} myTicketsPage
 * @property {AIHelpdeskPage} aiHelpdeskPage
 * @property {import('@playwright/test').Page} employeePage
 */

/** @type {import('@playwright/test').TestType<EmployeeFixtures & import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions, import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions>} */
// @ts-ignore
const test = base.test.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  employeeDashboardPage: async ({ page }, use) => {
    await use(new EmployeeDashboardPage(page));
  },
  myTicketsPage: async ({ page }, use) => {
    await use(new MyTicketsPage(page));
  },
  aiHelpdeskPage: async ({ page }, use) => {
    await use(new AIHelpdeskPage(page));
  },
  // Authenticated Employee page fixture
  employeePage: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDENTIALS.employee.email, CREDENTIALS.employee.password);
    await use(page);
  },
});

module.exports = {
  test,
  expect: base.expect,
};
