// ---------------------------------------------------------------------------
// excel-utils.js
//
// Shared Excel logic used by BOTH:
//   - reporter/excel-sync-reporter.js  (live per-test sync for a single npm run)
//   - run-all-tests.js                 (sequential multi-command orchestrator)
//
// Keeping it in one place guarantees that both paths use the same Test-ID
// mapping (./test-id-map.js), the same status labels, and the same safe
// write procedure.
//
//   Excel Test ID  <->  Playwright test (spec file + title)  <->  NPM command
//
// Safe write procedure (saveWorkbook):
//   1. take an exclusive lock file (only ONE writer at a time, across processes)
//   2. write the workbook to a temp file
//   3. atomically rename the temp file over the real workbook
//   4. release the lock
// A crash mid-write therefore can never leave a half-written .xlsx behind.
// ---------------------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const coverageMap = require('./test-id-map');

// MASTER template. It is only ever READ - every run writes into its own timestamped copy (see createReport).
const EXCEL_PATH =
  process.env.EXCEL_RESULTS_PATH || path.join(__dirname, '..', 'ITSM_2_0_Test_Cases.xlsx');
const MASTER_PATH = EXCEL_PATH;
const REPORT_DIR = process.env.EXCEL_REPORT_DIR || path.join(__dirname, '..', 'test-results', 'excel');
const SUMMARY_SHEET = 'Execution Summary';

// Sheets that hold test cases (each has a Test ID column + NPM Command column).
const TEST_SHEETS = ['Admin Test Cases', 'Employee Test Cases', 'IT Staff Test Cases', 'AI Helpdesk Test Cases'];

// Labels written to the Result column.
const RESULT = { PASS: 'PASS', FAIL: 'FAIL', NOT_EXECUTED: 'NOT EXECUTED', SKIPPED: 'SKIPPED', BLOCKED: 'Blocked' };
// Dropdown offered on every Result cell we write. Legacy labels are kept so
// values typed by hand before this change remain valid.
const RESULT_DROPDOWN = 'PASS,FAIL,NOT EXECUTED,SKIPPED,Passed,Failed,Blocked,Not Run,Pending';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
const canon = (s) => String(s || '').replace(/\s+/g, '').toUpperCase(); // "TQ- 43" -> "TQ-43"

function cellText(cell) {
  try {
    return String(cell.text == null ? '' : cell.text).trim();
  } catch (_) {
    return String(cell.value == null ? '' : cell.value).trim();
  }
}

// Rows 2-37 in "Admin Test Cases" are grouped 3-row blocks for the login matrix.
// Step 3 (the outcome row with expected result) is at rows: 4, 7, 10, 13 (Admin),
// 16, 19, 22, 25 (IT Staff), 28, 31, 34, 37 (Employee).
const LOGIN_MATRIX_ROWS = {
  'ITSM-01-1': { sheet: 'Admin Test Cases', rowNumber: 4,  parent: 'ITSM-01', index: 1 },
  'ITSM-01-2': { sheet: 'Admin Test Cases', rowNumber: 7,  parent: 'ITSM-01', index: 2 },
  'ITSM-01-3': { sheet: 'Admin Test Cases', rowNumber: 10, parent: 'ITSM-01', index: 3 },
  'ITSM-01-4': { sheet: 'Admin Test Cases', rowNumber: 13, parent: 'ITSM-01', index: 4 },
  'ITSM-02-1': { sheet: 'Admin Test Cases', rowNumber: 16, parent: 'ITSM-02', index: 1 },
  'ITSM-02-2': { sheet: 'Admin Test Cases', rowNumber: 19, parent: 'ITSM-02', index: 2 },
  'ITSM-02-3': { sheet: 'Admin Test Cases', rowNumber: 22, parent: 'ITSM-02', index: 3 },
  'ITSM-02-4': { sheet: 'Admin Test Cases', rowNumber: 25, parent: 'ITSM-02', index: 4 },
  'ITSM-03-1': { sheet: 'Admin Test Cases', rowNumber: 28, parent: 'ITSM-03', index: 1 },
  'ITSM-03-2': { sheet: 'Admin Test Cases', rowNumber: 31, parent: 'ITSM-03', index: 2 },
  'ITSM-03-3': { sheet: 'Admin Test Cases', rowNumber: 34, parent: 'ITSM-03', index: 3 },
  'ITSM-03-4': { sheet: 'Admin Test Cases', rowNumber: 37, parent: 'ITSM-03', index: 4 },
};

const LOGIN_MATRIX_ROW_NUMBERS = new Map(
  Object.entries(LOGIN_MATRIX_ROWS).map(([id, info]) => [info.rowNumber, id])
);
const LOGIN_MATRIX_HEADER_ROWS = new Set([2, 14, 26]);

// ------------------------------ ID helpers ---------------------------------
const PREFIX_RE = /^([A-Za-z]+(?:-[A-Za-z]+)*)[\s-]+\d/;

function extractPrefix(id) {
  if (!id) return null;
  const m = String(id).trim().match(PREFIX_RE);
  return m ? m[1].toUpperCase() : null;
}

/** Test IDs embedded in a Playwright test title, e.g. "AIHD-EMP-01: ..." */
function idsFromTitle(title) {
  const found = String(title || '').match(/\b[A-Z]+(?:-[A-Za-z]+)*-\s?\d+(?:-\d+)?\b/g) || [];
  return new Set(found.map(canon));
}

function normalizeStatus(status) {
  switch (status) {
    case 'passed':
      return RESULT.PASS;
    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return RESULT.FAIL;
    case 'skipped':
      return RESULT.SKIPPED;
    default:
      return RESULT.BLOCKED;
  }
}

function findColumn(headerRow, candidates) {
  let found = null;
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = (cell.value || '').toString().trim().toLowerCase();
    if (!found && candidates.some((c) => val === c.toLowerCase())) found = colNumber;
  });
  return found;
}

function getColumns(ws) {
  const h = ws.getRow(1);
  return {
    id: 1, // Test ID is always column A in this workbook
    actual: findColumn(h, ['Actual Result']) || 5,
    exec: findColumn(h, ['Execution Date/Time', 'Execution']) || 6,
    result: findColumn(h, ['Result']) || 7,
    npm: findColumn(h, ['NPM Command']),
  };
}

// ----------------------------- NPM commands --------------------------------
/** "npm run a, npm run b" -> ['npm run a', 'npm run b'] (non-npm text such as "Not automated yet (manual)" is ignored) */
function commandsInCell(text) {
  return String(text || '')
    .split(/[,;\n]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /^npm\s/i.test(s));
}

/**
 * Reads the workbook and returns the unique NPM commands in the order they
 * first appear (sheet order, then row order), plus the number of Excel rows
 * that list each one. Nothing is hardcoded.
 */
function readCommandPlan(workbook) {
  const order = [];
  const listedRows = new Map();
  for (const name of TEST_SHEETS) {
    const ws = workbook.getWorksheet(name);
    if (!ws) continue;
    const cols = getColumns(ws);
    if (!cols.npm) continue;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (!cellText(row.getCell(cols.id)) && !(name === 'Admin Test Cases' && LOGIN_MATRIX_ROW_NUMBERS.has(rowNumber))) return;
      for (const cmd of commandsInCell(cellText(row.getCell(cols.npm)))) {
        if (!listedRows.has(cmd)) {
          listedRows.set(cmd, 0);
          order.push(cmd);
        }
        listedRows.set(cmd, listedRows.get(cmd) + 1);
      }
    });
  }
  return { order, listedRows };
}

// ------------------------------- mapping -----------------------------------
function matchEntries(filePath, title) {
  const f = String(filePath || '').replace(/\\/g, '/');
  return coverageMap.filter((e) => f.endsWith(e.file) && (!e.titleIncludes || String(title).includes(e.titleIncludes)));
}

function matchesEntry(entry, idStr) {
  const id = canon(idStr);
  const explicit = (entry.ids || []).map(canon);
  if (LOGIN_MATRIX_ROWS[id]) {
    // Login matrix sub-cases MUST be explicitly targeted by their sub-ID.
    // They must NEVER be touched by generic prefix rules (e.g. prefixes: ['ITSM']).
    return explicit.includes(id);
  }
  const prefix = extractPrefix(String(idStr).trim());
  return explicit.includes(id) || (prefix && (entry.prefixes || []).includes(prefix));
}

/** Rows selected by the given map entries. When `command` is set, only rows whose NPM Command cell lists it. */
function collectCandidateRows(workbook, entries, command) {
  const seen = new Map();
  for (const entry of entries) {
    const ws = workbook.getWorksheet(entry.sheet);
    if (!ws) continue;
    const cols = getColumns(ws);

    // Direct resolution for explicit login matrix sub-IDs
    const lmIds = (entry.ids || []).filter((id) => LOGIN_MATRIX_ROWS[id]);
    if (lmIds.length > 0) {
      for (const lmId of lmIds) {
        const info = LOGIN_MATRIX_ROWS[lmId];
        if (ws.name !== info.sheet) continue;
        const row = ws.getRow(info.rowNumber);
        const key = `${ws.name}#${info.rowNumber}`;
        if (!seen.has(key)) seen.set(key, { ws, cols, row, rowNumber: info.rowNumber, id: lmId });
      }
      continue;
    }

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (entry.sheet === 'Admin Test Cases' && LOGIN_MATRIX_HEADER_ROWS.has(rowNumber)) return;
      const id = cellText(row.getCell(cols.id));
      if (!id || !matchesEntry(entry, id)) return;
      if (command) {
        if (!cols.npm) return;
        if (!commandsInCell(cellText(row.getCell(cols.npm))).includes(command)) return;
      }
      const key = `${ws.name}#${rowNumber}`;
      if (!seen.has(key)) seen.set(key, { ws, cols, row, rowNumber, id });
    });
  }
  return [...seen.values()];
}

/** Every Excel row that `command` is able to update (listed for it AND covered by test-id-map). */
function mappedRowsForCommand(workbook, command) {
  const entries = coverageMap.filter((e) => e.npmCommand === command);
  return collectCandidateRows(workbook, entries, command);
}

// ------------------------------- writing -----------------------------------
function formatTimestamp(iso) {
  const d = iso ? new Date(iso) : new Date();
  return (isNaN(d.getTime()) ? new Date() : d).toLocaleString();
}

function buildActualResult(record, status) {
  const failing = ['failed', 'timedOut', 'interrupted'].includes(record.status);
  const err = failing && record.error ? stripAnsi(record.error).split('\n')[0].replace(/^Error:\s*/, '').slice(0, 300) : '';
  const base = record.actualResult || `${record.title} - ${status}`;
  const retry = record.retry > 0 ? ` [attempt ${record.retry + 1}]` : '';
  return err ? `${base}${retry} | Error: ${err}` : `${base}${retry}`;
}

function writeRow(item, result, actual, timestamp) {
  item.row.getCell(item.cols.actual).value = actual;
  item.row.getCell(item.cols.exec).value = timestamp;
  const rc = item.row.getCell(item.cols.result);
  rc.value = result;
  rc.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${RESULT_DROPDOWN}"`] };
  return { sheet: item.ws.name, rowNumber: item.rowNumber, id: item.id, cols: item.cols, result, actual, exec: timestamp };
}

/**
 * Writes one Playwright test result into the in-memory workbook.
 * record: { file, title, status, retry, error, actualResult, endedAt }
 * opts.command: restrict to rows that list this NPM command.
 * Does NOT save - call saveWorkbook afterwards.
 */
function applyRecord(workbook, record, opts = {}) {
  const entries = matchEntries(record.file, record.title);
  if (entries.length === 0) return { matched: false, touched: [] };

  let rows = collectCandidateRows(workbook, entries, opts.command);

  // If the test title names specific Test IDs (e.g. "AIHD-EMP-01: ..."), only
  // those rows get this test's result instead of every row sharing the prefix.
  const titleIds = idsFromTitle(record.title);
  if (record.testId) {
    titleIds.add(canon(record.testId));
  }
  if (titleIds.size) {
    const narrowed = rows.filter((r) => titleIds.has(canon(r.id)));
    if (narrowed.length) rows = narrowed;
  }

  // A skipped test never ran: its row stays NOT EXECUTED. A test cut off mid-run by Ctrl+C / termination
  // did not finish, so it is NOT EXECUTED too (never FAIL, which is reserved for tests that ran and failed).
  if (record.status === 'skipped') return { matched: true, touched: [] };
  const cutOff = record.status === 'interrupted';
  const result = cutOff ? RESULT.NOT_EXECUTED : normalizeStatus(record.status);
  const actual = cutOff ? `${record.title} - interrupted before completion` : buildActualResult(record, result);
  const ts = formatTimestamp(record.endedAt);
  return { matched: true, touched: rows.map((r) => writeRow(r, result, actual, ts)) };
}

/** Marks rows (from mappedRowsForCommand) with an explicit result, e.g. FAIL when the command crashed. */
function markRows(rows, result, actual) {
  const ts = formatTimestamp();
  return rows.map((r) => writeRow(r, result, actual, ts));
}


// ------------------------- per-run report (timestamped copy) -------------------------
function pad2(n) {
  return String(n).padStart(2, '0');
}
function fileStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
}

/** The command the user typed, e.g. "npm run test:admin:tickets" (falls back to the playwright CLI args). */
function currentNpmCommand() {
  const ev = process.env.npm_lifecycle_event;
  if (ev && ev !== 'npx') return `npm run ${ev}`;
  return `npx playwright ${process.argv.slice(2).join(' ')}`.trim();
}

/** Every Test-ID row of the four test sheets: { ws, cols, row, rowNumber, id } */
function idRows(workbook) {
  const out = [];
  for (const name of TEST_SHEETS) {
    const ws = workbook.getWorksheet(name);
    if (!ws) continue;
    const cols = getColumns(ws);
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (name === 'Admin Test Cases' && LOGIN_MATRIX_HEADER_ROWS.has(rowNumber)) {
        return;
      }
      const id = cellText(row.getCell(cols.id));
      if (id) {
        out.push({ ws, cols, row, rowNumber, id });
      } else if (name === 'Admin Test Cases' && LOGIN_MATRIX_ROW_NUMBERS.has(rowNumber)) {
        const subId = LOGIN_MATRIX_ROW_NUMBERS.get(rowNumber);
        out.push({ ws, cols, row, rowNumber, id: subId });
      }
    });
  }
  return out;
}

/** Fresh report: every test case NOT EXECUTED, stale actual-result / execution-time cleared. Column H is left alone. */
function initializeResults(workbook) {
  const rows = idRows(workbook);
  for (const r of rows) {
    r.row.getCell(r.cols.actual).value = null;
    r.row.getCell(r.cols.exec).value = null;
    const rc = r.row.getCell(r.cols.result);
    rc.value = RESULT.NOT_EXECUTED;
    rc.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${RESULT_DROPDOWN}"`] };
  }
  return rows.length;
}

function countResults(workbook) {
  const c = { total: 0, passed: 0, failed: 0, notExecuted: 0, other: 0 };
  for (const r of idRows(workbook)) {
    c.total++;
    const v = cellText(r.row.getCell(r.cols.result)).toUpperCase();
    if (v === RESULT.PASS) c.passed++;
    else if (v === RESULT.FAIL) c.failed++;
    else if (v === RESULT.NOT_EXECUTED || v === '') c.notExecuted++;
    else c.other++;
  }
  return c;
}

/**
 * Adds / refreshes the "Execution Summary" sheet (the only sheet this module adds; the test sheets keep their structure).
 * info: { startedText, endedText, status, npmCommand, notes, reportFile }
 */
function writeSummary(workbook, info) {
  let ws = workbook.getWorksheet(SUMMARY_SHEET);
  if (!ws) ws = workbook.addWorksheet(SUMMARY_SHEET);
  const c = countResults(workbook);
  const executed = c.passed + c.failed;
  const rows = [
    ['Execution Start', info.startedText || ''],
    ['Execution End', info.endedText || ''],
    ['Last Updated', new Date().toLocaleString()],
    ['Execution Status', info.status || ''],
    ['Total Tests', c.total],
    ['Passed', c.passed],
    ['Failed', c.failed],
    ['Not Executed', c.notExecuted],
    ['Pass Percentage (of executed tests)', executed ? `${((c.passed / executed) * 100).toFixed(1)}%` : 'N/A'],
    ['NPM Command', info.npmCommand || ''],
    ['Report File', info.reportFile || ''],
    ['Notes', info.notes || ''],
  ];
  rows.forEach(([k, v], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = v;
  });
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 70;
  return c;
}

/** Creates ITSM_Test_Report_<timestamp>.xlsx from the master, initializes it and saves it. Never touches the master. */
async function createReport(opts = {}) {
  const ExcelJS = require('exceljs');
  if (!fs.existsSync(MASTER_PATH)) throw new Error(`Master Excel template not found: ${MASTER_PATH}`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const base = `ITSM_Test_Report_${fileStamp()}`;
  let reportPath = path.join(REPORT_DIR, `${base}.xlsx`);
  for (let n = 2; fs.existsSync(reportPath); n++) reportPath = path.join(REPORT_DIR, `${base}_${n}.xlsx`); // never overwrite
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(MASTER_PATH);
  initializeResults(workbook);
  const info = {
    startedText: new Date().toLocaleString(),
    endedText: '',
    status: 'RUNNING',
    npmCommand: opts.npmCommand || currentNpmCommand(),
    notes: '',
    reportFile: path.basename(reportPath),
  };
  writeSummary(workbook, info);
  await saveWorkbook(workbook, reportPath);
  return { workbook, path: reportPath, info };
}

/** Newest existing report file (used by run-all-tests --resume), or null. */
function latestReport() {
  try {
    const files = fs.readdirSync(REPORT_DIR).filter((f) => /^ITSM_Test_Report_.*\.xlsx$/.test(f)).sort();
    return files.length ? path.join(REPORT_DIR, files[files.length - 1]) : null;
  } catch (_) {
    return null;
  }
}

/** Reads back the info block of an existing report's summary sheet (for --resume). */
function readSummaryInfo(workbook, reportPath) {
  const ws = workbook.getWorksheet(SUMMARY_SHEET);
  const get = (label) => {
    let v = '';
    if (ws) ws.eachRow((row) => { if (cellText(row.getCell(1)) === label) v = cellText(row.getCell(2)); });
    return v;
  };
  return {
    startedText: get('Execution Start') || new Date().toLocaleString(),
    endedText: '',
    status: 'RUNNING',
    npmCommand: get('NPM Command'),
    notes: get('Notes'),
    reportFile: path.basename(reportPath),
  };
}

// --------------------------- lock + atomic save ----------------------------
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** Exclusive cross-process lock via O_EXCL lock file. Returns a release() function. */
async function acquireLock(lockPath, timeoutMs = 60_000) {
  const start = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return () => {
        try {
          fs.unlinkSync(lockPath);
        } catch (_) {}
      };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let owner = NaN;
      try {
        owner = parseInt(fs.readFileSync(lockPath, 'utf8'), 10);
      } catch (_) {}
      if (!owner || !pidAlive(owner)) {
        try {
          fs.unlinkSync(lockPath); // stale lock from a dead process
        } catch (_) {}
        continue;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting for Excel write lock held by PID ${owner} (${lockPath}).`);
      }
      await sleep(250);
    }
  }
}

async function renameWithRetry(from, to, attempts = 8) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      lastErr = e;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) break;
      await sleep(1000);
    }
  }
  const hint = ['EBUSY', 'EPERM', 'EACCES'].includes(lastErr.code)
    ? ' The workbook is probably open in Excel - close it and re-run (use --resume to continue).'
    : '';
  throw new Error(`Could not replace ${to}: ${lastErr.message}.${hint}`);
}

/** Serialized, atomic save of the workbook. Resolves only after the file on disk has been replaced. */
async function saveWorkbook(workbook, filePath = EXCEL_PATH) {
  const release = await acquireLock(`${filePath}.lock`);
  const tmp = `${filePath}.tmp-${process.pid}`;
  try {
    await workbook.xlsx.writeFile(tmp);
    if (fs.statSync(tmp).size === 0) throw new Error('Workbook write produced an empty file.');
    await renameWithRetry(tmp, filePath);
  } finally {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (_) {}
    release();
  }
}

/** Re-opens the saved file from disk and checks every expected cell really landed. */
async function verifyRows(expected, requiredSheets = [], filePath = EXCEL_PATH) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const problems = [];
  for (const name of requiredSheets) if (!wb.getWorksheet(name)) problems.push(`sheet "${name}" is missing`);
  for (const e of expected) {
    const ws = wb.getWorksheet(e.sheet);
    if (!ws) {
      problems.push(`sheet "${e.sheet}" is missing`);
      continue;
    }
    const row = ws.getRow(e.rowNumber);
    const isLoginMatrix = !!LOGIN_MATRIX_ROWS[e.id];
    if (!isLoginMatrix && cellText(row.getCell(e.cols.id)) !== e.id) problems.push(`${e.sheet} row ${e.rowNumber}: Test ID changed (expected ${e.id})`);
    if (cellText(row.getCell(e.cols.result)) !== e.result) problems.push(`${e.sheet} ${e.id}: Result not saved`);
    if (cellText(row.getCell(e.cols.actual)) !== String(e.actual).trim()) problems.push(`${e.sheet} ${e.id}: Actual Result not saved`);
    if (cellText(row.getCell(e.cols.exec)) !== String(e.exec).trim()) problems.push(`${e.sheet} ${e.id}: Execution time not saved`);
  }
  return { ok: problems.length === 0, problems };
}

async function openFile(filePath) {
  let cmd;
  if (process.platform === 'win32') cmd = `start "" "${filePath}"`;
  else if (process.platform === 'darwin') cmd = `open "${filePath}"`;
  else cmd = `xdg-open "${filePath}"`;
  await execAsync(cmd);
}

module.exports = {
  EXCEL_PATH,
  MASTER_PATH,
  REPORT_DIR,
  SUMMARY_SHEET,
  LOGIN_MATRIX_ROWS,
  LOGIN_MATRIX_ROW_NUMBERS,
  createReport,
  latestReport,
  readSummaryInfo,
  initializeResults,
  countResults,
  writeSummary,
  currentNpmCommand,
  idRows,
  TEST_SHEETS,
  RESULT,
  RESULT_DROPDOWN,
  cellText,
  canon,
  stripAnsi,
  extractPrefix,
  idsFromTitle,
  normalizeStatus,
  findColumn,
  getColumns,
  commandsInCell,
  readCommandPlan,
  matchEntries,
  mappedRowsForCommand,
  applyRecord,
  markRows,
  acquireLock,
  saveWorkbook,
  verifyRows,
  openFile,
};
