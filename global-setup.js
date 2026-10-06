// ---------------------------------------------------------------------------
// global-setup.js
//
// Runs once, before Playwright collects/executes any test. Reads the
// "AI Helpdesk Test Cases" sheet out of ITSM_2_0_Test_Cases.xlsx - in the
// exact row order the rows appear in Excel - and writes that ordered list to
// test-data/ai-helpdesk-excel-cases.generated.json.
//
// tests/admin/ai-helpdesk.spec.js, tests/employee/ai-helpdesk.spec.js and
// tests/it-staff/ai-helpdesk.spec.js each read that JSON synchronously at
// module-load time and generate one Playwright test() per row, in the same
// order. Excel is therefore the actual source of truth for which chatbot
// scenarios run and in what order - no hardcoded test list to keep in sync
// by hand.
//
// This file is wired in via playwright.config.js's `globalSetup` option, so
// it runs automatically as part of the normal `npm run test:...` commands -
// no separate command needed.
// ---------------------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const EXCEL_PATH = process.env.EXCEL_RESULTS_PATH || path.join(__dirname, 'ITSM_2_0_Test_Cases.xlsx');
const OUT_PATH = path.join(__dirname, 'test-data', 'ai-helpdesk-excel-cases.generated.json');
const SHEET_NAME = 'AI Helpdesk Test Cases';

module.exports = async function globalSetup() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.warn(`[global-setup] Excel file not found at ${EXCEL_PATH} - AI Helpdesk specs will have no test cases to run.`);
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify([]));
    return;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const ws = workbook.getWorksheet(SHEET_NAME);

  if (!ws) {
    console.warn(`[global-setup] Sheet "${SHEET_NAME}" not found in ${EXCEL_PATH} - AI Helpdesk specs will have no test cases to run.`);
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify([]));
    return;
  }

  const header = ws.getRow(1).values; // 1-indexed sparse array: [empty, col1, col2, ...]
  const col = (name) => header.findIndex((v) => (v || '').toString().trim() === name);

  const idCol = col('Test ID');
  const descCol = col('Test Case Description');
  const dashboardCol = col('Dashboard');
  const queryCol = col('Chatbot Query To Send');
  const expectedCol = col('Expected Resolution Behavior');

  const cases = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const testId = row.getCell(idCol).value;
    const query = row.getCell(queryCol).value;
    if (!testId || !query) return; // skip blank/incomplete rows rather than guessing
    cases.push({
      excelRow: rowNumber,
      testId: String(testId).trim(),
      description: (row.getCell(descCol).value || '').toString().trim(),
      dashboard: (row.getCell(dashboardCol).value || '').toString().trim(),
      query: String(query).trim(),
      expectedBehavior: (row.getCell(expectedCol).value || '').toString().trim(),
    });
  });

  // ws.eachRow already visits rows in ascending row-number order, i.e. exactly
  // the order they appear in Excel - but sort explicitly so this stays true
  // even if a future exceljs version changes that iteration guarantee.
  cases.sort((a, b) => a.excelRow - b.excelRow);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(cases, null, 2));
  console.log(`[global-setup] Read ${cases.length} AI Helpdesk test case(s) from "${SHEET_NAME}" (Excel row order preserved) -> ${OUT_PATH}`);
};
