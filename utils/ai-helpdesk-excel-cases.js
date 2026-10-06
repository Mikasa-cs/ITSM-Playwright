// @ts-check
// ---------------------------------------------------------------------------
// Reads test-data/ai-helpdesk-excel-cases.generated.json (written once per
// run by global-setup.js, straight from ITSM_2_0_Test_Cases.xlsx) and
// returns just the rows for one dashboard, already in Excel row order.
//
// Loaded synchronously at module scope in each ai-helpdesk.spec.js file, so
// the test() calls it generates are registered - and therefore executed,
// since this project runs with a single worker / fullyParallel: false - in
// that same order.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const GENERATED_PATH = path.join(__dirname, '..', 'test-data', 'ai-helpdesk-excel-cases.generated.json');

/**
 * @param {string} dashboard - exact "Dashboard" column value: 'Admin' | 'Employee' | 'IT Staff'
 * @returns {Array<{excelRow:number, testId:string, description:string, dashboard:string, query:string, expectedBehavior:string}>}
 */
function loadAiHelpdeskCases(dashboard) {
  let all = [];
  try {
    all = JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf-8'));
  } catch (err) {
    console.warn(
      `[ai-helpdesk-excel-cases] Could not read ${GENERATED_PATH} (${err.message}). ` +
        `Did playwright.config.js's globalSetup run? No AI Helpdesk test cases will be generated for this run.`
    );
    return [];
  }
  return all.filter((c) => c.dashboard === dashboard);
}

/** True when the Excel "Expected Resolution Behavior" text allows a legitimate decline. */
function allowsDecline(expectedBehavior) {
  return /declin|out of scope|may not resolve|cannot resolve is acceptable/i.test(expectedBehavior || '');
}

module.exports = { loadAiHelpdeskCases, allowsDecline };
