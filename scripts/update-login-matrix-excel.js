#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/update-login-matrix-excel.js
//
// Updates BOTH:
//   1. The master workbook ITSM_2_0_Test_Cases.xlsx
//   2. The latest per-run report in test-results/excel/
// with the exact execution results of the 12-case login authentication matrix:
//   ITSM-01 (Admin)     -> Rows 4, 7, 10, 13
//   ITSM-02 (IT Staff)  -> Rows 16, 19, 22, 25
//   ITSM-03 (Employee)  -> Rows 28, 31, 34, 37
//
// Guarantees:
//   - Isolated role execution: Admin results NEVER bleed into IT Staff/Employee
//   - Only the exact outcome row for each case is updated
//   - Full metadata written: Actual Result, Execution Date/Time, PASS/FAIL, NPM Command
// ---------------------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const X = require('../reporter/excel-utils');

const RESULTS_FILE = path.join(__dirname, '..', 'test-results', 'login-matrix-results.json');

const MATRIX_MAP = {
  'ITSM-01-1': { sheet: 'Admin Test Cases', rowNumber: 4,  role: 'Admin',    scenario: 'Valid ID + Valid Password > GRANTED' },
  'ITSM-01-2': { sheet: 'Admin Test Cases', rowNumber: 7,  role: 'Admin',    scenario: 'Valid ID + Invalid Password > DENIED' },
  'ITSM-01-3': { sheet: 'Admin Test Cases', rowNumber: 10, role: 'Admin',    scenario: 'Invalid ID + Valid Password > DENIED' },
  'ITSM-01-4': { sheet: 'Admin Test Cases', rowNumber: 13, role: 'Admin',    scenario: 'Invalid ID + Invalid Password > DENIED' },
  'ITSM-02-1': { sheet: 'Admin Test Cases', rowNumber: 16, role: 'IT Staff', scenario: 'Valid ID + Valid Password > GRANTED' },
  'ITSM-02-2': { sheet: 'Admin Test Cases', rowNumber: 19, role: 'IT Staff', scenario: 'Valid ID + Invalid Password > DENIED' },
  'ITSM-02-3': { sheet: 'Admin Test Cases', rowNumber: 22, role: 'IT Staff', scenario: 'Invalid ID + Valid Password > DENIED' },
  'ITSM-02-4': { sheet: 'Admin Test Cases', rowNumber: 25, role: 'IT Staff', scenario: 'Invalid ID + Invalid Password > DENIED' },
  'ITSM-03-1': { sheet: 'Admin Test Cases', rowNumber: 28, role: 'Employee', scenario: 'Valid ID + Valid Password > GRANTED' },
  'ITSM-03-2': { sheet: 'Admin Test Cases', rowNumber: 31, role: 'Employee', scenario: 'Valid ID + Invalid Password > DENIED' },
  'ITSM-03-3': { sheet: 'Admin Test Cases', rowNumber: 34, role: 'Employee', scenario: 'Invalid ID + Valid Password > DENIED' },
  'ITSM-03-4': { sheet: 'Admin Test Cases', rowNumber: 37, role: 'Employee', scenario: 'Invalid ID + Invalid Password > DENIED' },
};

async function updateWorkbook(filePath, results, isMaster = false) {
  if (!fs.existsSync(filePath)) return null;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet('Admin Test Cases');
  if (!ws) throw new Error(`Worksheet "Admin Test Cases" not found in ${filePath}`);

  const cols = X.getColumns(ws);
  let updatedCount = 0;

  for (const [id, meta] of Object.entries(MATRIX_MAP)) {
    const res = results[id];
    if (!res) continue;

    const row = ws.getRow(meta.rowNumber);
    row.getCell(cols.actual).value = res.actual || '';
    row.getCell(cols.exec).value = res.executedAt ? new Date(res.executedAt).toLocaleString() : new Date().toLocaleString();
    const resultCell = row.getCell(cols.result);
    resultCell.value = res.status;
    resultCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${X.RESULT_DROPDOWN}"`],
    };

    if (cols.npm) {
      row.getCell(cols.npm).value = 'npm run test:login:matrix';
    }
    updatedCount++;
  }

  // Update Execution Summary sheet if present
  if (wb.getWorksheet(X.SUMMARY_SHEET)) {
    const summaryInfo = X.readSummaryInfo(wb, filePath);
    summaryInfo.endedText = new Date().toLocaleString();
    summaryInfo.status = 'COMPLETED';
    summaryInfo.npmCommand = 'npm run test:login:matrix';
    X.writeSummary(wb, summaryInfo);
  }

  await X.saveWorkbook(wb, filePath);
  return { path: filePath, updatedCount };
}

async function main() {
  console.log('\n============================================================');
  console.log('   ITSM LOGIN MATRIX - EXCEL REPORT SYNCHRONIZER');
  console.log('============================================================\n');

  if (!fs.existsSync(RESULTS_FILE)) {
    console.warn(`[WARN] Results file not found at ${RESULTS_FILE}`);
    console.warn('       Run "npm run test:login:matrix" first.');
    return;
  }

  let results = {};
  try {
    results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  } catch (err) {
    console.error(`[ERROR] Failed to read results file: ${err.message}`);
    process.exit(1);
  }

  const resultKeys = Object.keys(results);
  console.log(`Loaded ${resultKeys.length} test result(s) from ${path.basename(RESULTS_FILE)}:`);
  console.log('------------------------------------------------------------');
  console.log(
    'ID'.padEnd(12) +
    'ROLE'.padEnd(12) +
    'RESULT'.padEnd(10) +
    'EXCEL ROW'.padEnd(12) +
    'SCENARIO'
  );
  console.log('------------------------------------------------------------');

  for (const [id, meta] of Object.entries(MATRIX_MAP)) {
    const r = results[id];
    const status = r ? r.status : 'NOT RUN';
    console.log(
      id.padEnd(12) +
      meta.role.padEnd(12) +
      status.padEnd(10) +
      `Row ${meta.rowNumber}`.padEnd(12) +
      meta.scenario
    );
  }
  console.log('------------------------------------------------------------\n');

  // 1. Update master workbook
  try {
    const masterRes = await updateWorkbook(X.MASTER_PATH, results, true);
    if (masterRes) {
      console.log(`[SUCCESS] Master Excel updated (${masterRes.updatedCount} rows): ${masterRes.path}`);
    }
  } catch (err) {
    console.warn(`[WARN] Could not update master Excel: ${err.message}`);
  }

  // 2. Update latest per-run report
  try {
    const latest = X.latestReport();
    if (latest) {
      const reportRes = await updateWorkbook(latest, results, false);
      if (reportRes) {
        console.log(`[SUCCESS] Latest Report updated (${reportRes.updatedCount} rows): ${reportRes.path}`);
      }
    }
  } catch (err) {
    console.warn(`[WARN] Could not update latest report: ${err.message}`);
  }

  console.log('\n[DONE] Login matrix synchronization complete.\n');
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[ERROR]', e);
    process.exit(1);
  });
}

module.exports = { MATRIX_MAP, updateWorkbook };
