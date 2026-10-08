// @ts-check
// ---------------------------------------------------------------------------
// login-matrix.spec.js
//
// Executes the FULL authentication matrix for ITSM-01 / ITSM-02 / ITSM-03.
//   ITSM-01 (Admin)    4 cases | ITSM-02 (IT Staff) 4 cases | ITSM-03 (Employee) 4 cases
//
// Execution order: strictly serial, ITSM-01-1 through ITSM-03-4.
// Each case: isolated browser context (clean storageState) - no session leakage.
// ---------------------------------------------------------------------------
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, '..', '..', 'test-results', 'login-matrix-results.json');

function recordResult(excelId, role, status, actual) {
  try {
    fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
    let existing = {};
    if (fs.existsSync(RESULTS_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')); } catch (_) {}
    }
    existing[excelId] = {
      id: excelId,
      role,
      status,
      actual,
      executedAt: new Date().toISOString(),
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2));
  } catch (e) {
    console.warn('[login-matrix] Could not record result:', e.message);
  }
}

const BASE_URL = process.env.BASE_URL || 'https://ithelpdesk.vlinklabs.com';

const VALID = {
  admin:    { email: process.env.ADMIN_EMAIL    || 'admin@enterprise.com',    password: process.env.ADMIN_PASSWORD    || 'Password@123' },
  itstaff:  { email: process.env.ITSTAFF_EMAIL  || 'agent@enterprise.com',    password: process.env.ITSTAFF_PASSWORD  || 'Password@123' },
  employee: { email: process.env.EMPLOYEE_EMAIL || 'employee@enterprise.com', password: process.env.EMPLOYEE_PASSWORD || 'Password@123' },
};
const INVALID = { email: 'invalid.user@notexist.xyz', password: 'WrongPassword999!' };

// Dashboard text signatures per role (same as the passing smoke.spec.js)
const DASHBOARD_TEXT = {
  admin:    /System Administration/i,
  itstaff:  /IT Staff|Dashboard|Ticket Queue/i,
  employee: /Welcome|Employee|My Tickets|Support/i,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shared browser launch options */
function browserOpts() {
  return { headless: false, slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0 };
}

/**
 * Navigates to the login page and fills credentials.
 * Returns the submit button without performing long blind post-click waits.
 */
async function navigateAndFillLogin(page, email, password) {
  await page.goto(BASE_URL + '/#/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const emailInput    = page.getByPlaceholder(/name@company\.com/i).or(page.locator('input[type="email"]')).first();
  const passwordInput = page.locator('#login-password').or(page.locator('input[type="password"]')).first();
  const signInButton  = page.getByRole('button', { name: /sign in/i }).first();

  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  await emailInput.fill(email);

  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(password);

  return signInButton;
}

// ---------------------------------------------------------------------------
// ACCESS GRANTED runner
// Resolves immediately when navigation happens or dashboard text is visible
// ---------------------------------------------------------------------------
async function runAccessGranted(testInfo, role, excelId) {
  testInfo.annotations.push({ type: 'excel-test-id',     description: excelId });
  testInfo.annotations.push({ type: 'excel-npm-command', description: 'npm run test:admin:itsm' });

  const browser = await chromium.launch(browserOpts());
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page    = await context.newPage();
  try {
    const signInButton = await navigateAndFillLogin(page, VALID[role].email, VALID[role].password);
    await signInButton.click();

    // Standardized race: URL away from login OR role dashboard indicator appears
    const dashboardText = page.getByText(DASHBOARD_TEXT[role]).first();
    const errorText     = page.getByText(/Invalid email or password|invalid|incorrect|failed|unauthorized|wrong/i).first();

    const outcome = await Promise.race([
      page.waitForURL((url) => !url.toString().includes('login'), { timeout: 12000 }).then(() => 'GRANTED_URL'),
      dashboardText.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'GRANTED_TEXT'),
      errorText.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'UNEXPECTED_ERROR'),
    ]).catch(() => 'TIMEOUT');

    const reached = outcome === 'GRANTED_URL' || outcome === 'GRANTED_TEXT';
    const url     = page.url();
    const summary = reached
      ? 'ACCESS GRANTED - ' + role + ' user reached the correct dashboard. URL: ' + url
      : 'FAIL: ACCESS GRANTED expected but not reached (' + outcome + '). URL: ' + url;

    testInfo.annotations.push({ type: 'excel-actual-result', description: summary });
    recordResult(excelId, role, reached ? 'PASS' : 'FAIL', summary);
    expect(reached, '[' + excelId + '] ' + role + ' with valid credentials must reach the dashboard. Page URL was: ' + url).toBeTruthy();
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// ACCESS DENIED runner
// Resolves immediately when rejection error appears (~1s) without waiting on dashboard
// ---------------------------------------------------------------------------
async function runAccessDenied(testInfo, role, email, password, excelId, credDesc) {
  testInfo.annotations.push({ type: 'excel-test-id',     description: excelId });
  testInfo.annotations.push({ type: 'excel-npm-command', description: 'npm run test:admin:itsm' });

  const browser = await chromium.launch(browserOpts());
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page    = await context.newPage();
  try {
    const signInButton = await navigateAndFillLogin(page, email, password);
    await signInButton.click();

    // Standardized race: error banner appears (~1s) OR unexpected dashboard/URL
    const errorText     = page.getByText(/Invalid email or password|invalid|incorrect|failed|unauthorized|wrong/i).first();
    const dashboardText = page.getByText(DASHBOARD_TEXT[role]).first();

    const outcome = await Promise.race([
      errorText.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'DENIED_ERROR'),
      page.waitForURL((url) => !url.toString().includes('login'), { timeout: 5000 }).then(() => 'UNEXPECTED_GRANTED_URL'),
      dashboardText.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'UNEXPECTED_GRANTED_TEXT'),
    ]).catch(() => 'STILL_ON_LOGIN');

    const url       = page.url();
    const isBlocked = outcome === 'DENIED_ERROR' || (outcome === 'STILL_ON_LOGIN' && url.includes('login'));
    const summary = isBlocked
      ? 'ACCESS DENIED - ' + role + ' blocked with ' + credDesc + '. Outcome: ' + outcome + '. URL: ' + url
      : 'FAIL: ACCESS DENIED expected but user reached dashboard (' + outcome + '). URL: ' + url;

    testInfo.annotations.push({ type: 'excel-actual-result', description: summary });
    recordResult(excelId, role, isBlocked ? 'PASS' : 'FAIL', summary);
    expect(isBlocked, '[' + excelId + '] ' + role + ' with (' + credDesc + ') must NOT reach the dashboard. Outcome: ' + outcome).toBeTruthy();
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ============================================================================
// ITSM-01 - ADMIN (4 cases)
// ============================================================================
test.describe('ITSM-01: Admin Login Matrix', () => {
  test.describe.configure({ mode: 'serial' });

  test('ITSM-01-1: Admin | Valid ID + Valid Password > ACCESS GRANTED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessGranted(testInfo, 'admin', 'ITSM-01-1');
  });

  test('ITSM-01-2: Admin | Valid ID + Invalid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'admin', VALID.admin.email, INVALID.password, 'ITSM-01-2', 'valid ID + invalid password');
  });

  test('ITSM-01-3: Admin | Invalid ID + Valid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'admin', INVALID.email, VALID.admin.password, 'ITSM-01-3', 'invalid ID + valid password');
  });

  test('ITSM-01-4: Admin | Invalid ID + Invalid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'admin', INVALID.email, INVALID.password, 'ITSM-01-4', 'invalid ID + invalid password');
  });
});

// ============================================================================
// ITSM-02 - IT STAFF (4 cases)
// ============================================================================
test.describe('ITSM-02: IT Staff Login Matrix', () => {
  test.describe.configure({ mode: 'serial' });

  test('ITSM-02-1: IT Staff | Valid ID + Valid Password > ACCESS GRANTED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessGranted(testInfo, 'itstaff', 'ITSM-02-1');
  });

  test('ITSM-02-2: IT Staff | Valid ID + Invalid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'itstaff', VALID.itstaff.email, INVALID.password, 'ITSM-02-2', 'valid ID + invalid password');
  });

  test('ITSM-02-3: IT Staff | Invalid ID + Valid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'itstaff', INVALID.email, VALID.itstaff.password, 'ITSM-02-3', 'invalid ID + valid password');
  });

  test('ITSM-02-4: IT Staff | Invalid ID + Invalid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'itstaff', INVALID.email, INVALID.password, 'ITSM-02-4', 'invalid ID + invalid password');
  });
});

// ============================================================================
// ITSM-03 - EMPLOYEE (4 cases)
// ============================================================================
test.describe('ITSM-03: Employee Login Matrix', () => {
  test.describe.configure({ mode: 'serial' });

  test('ITSM-03-1: Employee | Valid ID + Valid Password > ACCESS GRANTED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessGranted(testInfo, 'employee', 'ITSM-03-1');
  });

  test('ITSM-03-2: Employee | Valid ID + Invalid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'employee', VALID.employee.email, INVALID.password, 'ITSM-03-2', 'valid ID + invalid password');
  });

  test('ITSM-03-3: Employee | Invalid ID + Valid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'employee', INVALID.email, VALID.employee.password, 'ITSM-03-3', 'invalid ID + valid password');
  });

  test('ITSM-03-4: Employee | Invalid ID + Invalid Password > ACCESS DENIED', async ({}, testInfo) => {
    testInfo.setTimeout(90000);
    await runAccessDenied(testInfo, 'employee', INVALID.email, INVALID.password, 'ITSM-03-4', 'invalid ID + invalid password');
  });
});
