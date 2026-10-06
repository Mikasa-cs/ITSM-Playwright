#!/usr/bin/env node
// ---------------------------------------------------------------------------
// run-parallel-tests.js
//
// Runs every concept branch SIMULTANEOUSLY in independent Playwright processes,
// each with --headed (browser window visible) by default.
//
// Usage:
//   npm run test:parallel                   — all branches, headed
//   npm run test:parallel:admin             — admin branches only, headed
//   npm run test:parallel:kpi               — KPI branch only, headed
//   npm run test:parallel:fp                — Forgot Password branch, headed
//   npm run test:parallel:rtc               — Real-Time Chat branches, headed
//   npm run test:parallel:chat              — Chatbot / AI Helpdesk branches, headed
//   npm run test:parallel:itstaff           — IT Staff branches, headed
//   npm run test:parallel:employee          — Employee branches, headed
//   node run-parallel-tests.js --only=kpi,fp,rtc
//   node run-parallel-tests.js --headless   — override: run all branches headless
//   node run-parallel-tests.js --dry-run    — preview without launching
//
// How it works:
//   1. Create ONE timestamped Excel report (from the master).
//   2. Each branch spawns its OWN independent `npx playwright test …` process
//      with EXCEL_COLLECT_FILE set so results queue up per-branch.
//   3. Every branch runs --headed (or --headless if flag passed).
//   4. As soon as a branch process exits its results are flushed to the
//      shared Excel report via the atomic lock in excel-utils.js.
//   5. A live status board refreshes every 3 s while branches run.
//   6. After ALL branches exit a final summary is printed.
//
// Excel safety:
//   excel-utils.js uses a filesystem lock (.lock) so concurrent branch
//   writers never corrupt the workbook — writes are serialised automatically.
// ---------------------------------------------------------------------------
'use strict';

const path      = require('path');
const fs        = require('fs');
const { spawn } = require('child_process');
const ExcelJS   = require('exceljs');
const X         = require('./reporter/excel-utils');

const ROOT    = __dirname;
const RUN_DIR = path.join(ROOT, '.parallel-run');

// ── CLI flags ───────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const flag      = (n) => args.includes(`--${n}`);
const opt       = (n) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const DRY_RUN   = flag('dry-run');
const HEADLESS  = flag('headless');           // default is HEADED
const HEADED    = !HEADLESS;                  // explicit for clarity
const ONLY_RAW  = opt('only');
const ONLY      = ONLY_RAW ? ONLY_RAW.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : null;

// Browser mode suffix appended to every Playwright command
const BROWSER_FLAG = HEADED ? '--headed' : '';

// ---------------------------------------------------------------------------
// BRANCH DEFINITIONS
//
// spec     – relative path(s) to the spec file(s) this branch runs
// concept  – human label shown in the status board
// group    – used by --only= filter
// sheet    – Excel sheet that receives results (for display only; actual
//            mapping is done by reporter/test-id-map.js via npmCommand)
// npmCommand – MUST match the NPM Command cell value in Excel AND a
//              test-id-map.js entry so results reach the correct rows.
//
// The branch spawns Playwright DIRECTLY (not via npm run …) so that
// --headed / --headless can be injected at runtime without duplicating
// scripts. The npmCommand is still passed via env so the Excel reporter
// can tag results correctly.
// ---------------------------------------------------------------------------
const ALL_BRANCHES = [

  // ══════════════════════════════════════════════════════════════════════
  // ADMIN
  // ══════════════════════════════════════════════════════════════════════
  {
    concept:    'ADMIN:ITSM',
    group:      'admin',
    spec:       'tests/admin/dashboard.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:itsm',
    sheet:      'Admin Test Cases',
    ids:        'ITSM-*',
  },
  {
    concept:    'ADMIN:TQ',
    group:      'admin',
    spec:       'tests/admin/ticket-queue.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:tickets',
    sheet:      'Admin Test Cases',
    ids:        'TQ-*',
  },
  {
    concept:    'ADMIN:LM',
    group:      'admin',
    spec:       'tests/admin/leave-management.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:leaves',
    sheet:      'Admin Test Cases',
    ids:        'LM-*',
  },
  {
    concept:    'ADMIN:AM',
    group:      'admin',
    spec:       'tests/admin/alert-management.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:alerts',
    sheet:      'Admin Test Cases',
    ids:        'AM-*',
  },
  {
    concept:    'ADMIN:UM',
    group:      'admin',
    spec:       'tests/admin/user-management.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:users',
    sheet:      'Admin Test Cases',
    ids:        'UM-*',
  },
  {
    concept:    'ADMIN:ISM',
    group:      'admin',
    spec:       'tests/admin/settings.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:settings',
    sheet:      'Admin Test Cases',
    ids:        'ISM-*',
  },
  {
    concept:    'ADMIN:KPI',
    group:      'kpi',
    spec:       'tests/admin/kpi-validation.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:kpi',
    sheet:      'Admin Test Cases',
    ids:        'KPI-001 … KPI-010',
  },
  {
    concept:    'ADMIN:FP',
    group:      'fp',
    spec:       'tests/auth/forgot-password.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:auth:forgot-password',
    sheet:      'Admin Test Cases',
    ids:        'FP-001 … FP-010',
  },
  {
    concept:    'ADMIN:CHAT',
    group:      'chat',
    spec:       'tests/admin/ai-helpdesk.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:admin:ai-helpdesk',
    sheet:      'AI Helpdesk Test Cases',
    ids:        'CHAT-001 … CHAT-004, CHAT-010',
  },

  // ══════════════════════════════════════════════════════════════════════
  // IT STAFF
  // ══════════════════════════════════════════════════════════════════════
  {
    concept:    'ITS:ITD',
    group:      'itstaff',
    spec:       'tests/it-staff/dashboard.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:itstaff:dashboard',
    sheet:      'IT Staff Test Cases',
    ids:        'ITD-*',
  },
  {
    concept:    'ITS:ITSTQ',
    group:      'itstaff',
    spec:       'tests/it-staff/ticket-queue.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:itstaff:tickets',
    sheet:      'IT Staff Test Cases',
    ids:        'ITS-TQ-*',
  },
  {
    concept:    'ITS:AC',
    group:      'itstaff',
    spec:       'tests/it-staff/ai-helpdesk.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:itstaff:ac',
    sheet:      'IT Staff Test Cases',
    ids:        'AC-*',
  },
  {
    concept:    'ITS:LR',
    group:      'itstaff',
    spec:       'tests/it-staff/ai-helpdesk.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:itstaff:lr',
    sheet:      'IT Staff Test Cases',
    ids:        'LR-*',
  },
  {
    concept:    'ITS:RTC',
    group:      'rtc',
    spec:       'tests/realtime/ticket-realtime-chat.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:itstaff:rtc',
    sheet:      'IT Staff Test Cases',
    ids:        'RTC-ITS-001 … RTC-ITS-008',
  },
  {
    concept:    'ITS:CHAT',
    group:      'chat',
    spec:       'tests/it-staff/ai-helpdesk.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:itstaff:ai-helpdesk',
    sheet:      'AI Helpdesk Test Cases',
    ids:        'CHAT-008, CHAT-009',
  },

  // ══════════════════════════════════════════════════════════════════════
  // EMPLOYEE
  // ══════════════════════════════════════════════════════════════════════
  {
    concept:    'EMP:ED',
    group:      'employee',
    spec:       'tests/employee/dashboard.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:employee:dashboard',
    sheet:      'Employee Test Cases',
    ids:        'ED-*',
  },
  {
    concept:    'EMP:EMT',
    group:      'employee',
    spec:       'tests/employee/my-tickets.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:employee:tickets',
    sheet:      'Employee Test Cases',
    ids:        'EMT-*',
  },
  {
    concept:    'EMP:CHAT',
    group:      'chat',
    spec:       'tests/employee/ai-helpdesk.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:employee:ai-helpdesk',
    sheet:      'AI Helpdesk Test Cases',
    ids:        'CHAT-005, CHAT-006, CHAT-007',
  },
  {
    concept:    'EMP:RTC',
    group:      'rtc',
    spec:       'tests/realtime/ticket-realtime-chat.spec.js',
    project:    'chromium',
    npmCommand: 'npm run test:employee:rtc',
    sheet:      'Employee Test Cases',
    ids:        'RTC-EMP-001 … RTC-EMP-006',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dedupedBranches(branches) {
  const seen = new Set();
  return branches.filter(b => {
    if (seen.has(b.npmCommand)) return false;
    seen.add(b.npmCommand);
    return true;
  });
}

function filterByOnly(branches) {
  if (!ONLY) return branches;
  return branches.filter(b =>
    ONLY.some(o =>
      b.group.includes(o) ||
      b.concept.toLowerCase().includes(o) ||
      b.npmCommand.toLowerCase().includes(o) ||
      (b.ids || '').toLowerCase().includes(o)
    )
  );
}

/** Build the exact Playwright CLI command string for a branch. */
function buildPlaywrightCmd(branch) {
  const parts = [
    'npx', 'playwright', 'test',
    branch.spec,
    `--project=${branch.project}`,
  ];
  if (HEADED) parts.push('--headed');
  return parts.join(' ');
}

const border  = '='.repeat(72);
const divider = '-'.repeat(72);

// ---------------------------------------------------------------------------
// Status board
// ---------------------------------------------------------------------------
function statusLine(branch) {
  const s    = branch.state;
  const icon = s === 'running' ? '⏳' : s === 'done' ? '✅' : s === 'failed' ? '❌' : '⭕';
  const mode = HEADED ? '[HEADED]' : '[HEADLESS]';
  const extra =
    s === 'running'                  ? `(${Math.round((Date.now() - branch.startedAt) / 1000)}s)` :
    s === 'done' || s === 'failed'   ? `[exit ${branch.exitCode}] ${Math.round(branch.durationMs / 1000)}s` : '';
  return `  ${icon} ${mode} ${branch.concept.padEnd(18)} ${branch.npmCommand.padEnd(40)} ${extra}`;
}

function printBoard(branches) {
  console.clear();
  console.log(`\n${border}`);
  console.log(`  PARALLEL PLAYWRIGHT EXECUTION — LIVE STATUS   (mode: ${HEADED ? 'HEADED 🖥' : 'HEADLESS'})`);
  console.log(divider);
  for (const b of branches) console.log(statusLine(b));
  console.log(divider);
  const done    = branches.filter(b => b.state === 'done').length;
  const failed  = branches.filter(b => b.state === 'failed').length;
  const running = branches.filter(b => b.state === 'running').length;
  const pending = branches.filter(b => b.state === 'pending').length;
  console.log(`  ⏳ Running: ${running}  ✅ Done: ${done}  ❌ Failed: ${failed}  ⭕ Pending: ${pending}  |  Total: ${branches.length}`);
  console.log(border + '\n');
}

// ---------------------------------------------------------------------------
// Excel flusher — called once per branch on exit
// ---------------------------------------------------------------------------
async function flushBranchResults(collectFile, reportPath, npmCommand) {
  let records = [];
  try {
    records = JSON.parse(fs.readFileSync(collectFile, 'utf8')).records || [];
  } catch (_) {}

  if (records.length === 0 && !fs.existsSync(collectFile)) {
    console.log(`[parallel] No collect file for ${npmCommand} — nothing to write.`);
    return;
  }

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(reportPath);

    const touched = [];
    for (const rec of records) {
      const res = X.applyRecord(wb, rec, { command: npmCommand });
      touched.push(...res.touched);
    }

    const done    = new Set(touched.map(r => `${r.sheet}#${r.rowNumber}`));
    const unmapped = X.mappedRowsForCommand(wb, npmCommand).filter(r => !done.has(`${r.ws.name}#${r.rowNumber}`));
    if (unmapped.length > 0) {
      console.log(`[parallel] ${npmCommand}: ${unmapped.length} mapped row(s) received no result (left NOT EXECUTED)`);
    }

    await X.saveWorkbook(wb, reportPath);
    console.log(`[parallel] ✓ ${npmCommand}: ${touched.length} row(s) updated in Excel`);
  } catch (err) {
    console.warn(`[parallel] ✗ ${npmCommand}: Excel update failed — ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Branch launcher
// ---------------------------------------------------------------------------
function launchBranch(branch, collectFile, reportPath) {
  const playwrightCmd = buildPlaywrightCmd(branch);

  const env = {
    ...process.env,
    EXCEL_COLLECT_FILE: collectFile,
    EXCEL_AUTO_OPEN:    'false',
    // Pass the npm command name so the Excel reporter tags rows correctly
    PLAYWRIGHT_BRANCH_NPM_COMMAND: branch.npmCommand,
    FORCE_COLOR: '1',
  };

  const child = spawn(playwrightCmd, {
    cwd:   ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });

  branch.state       = 'running';
  branch.startedAt   = Date.now();
  branch.child       = child;
  branch.collectFile = collectFile;
  branch.pwCmd       = playwrightCmd;

  const tail = { text: '' };
  child.stdout.on('data', d => { tail.text = (tail.text + d.toString()).slice(-5000); });
  child.stderr.on('data', d => { tail.text = (tail.text + d.toString()).slice(-5000); });

  return new Promise(resolve => {
    child.on('close', async (code) => {
      branch.exitCode   = code === null ? -1 : code;
      branch.durationMs = Date.now() - branch.startedAt;
      branch.state      = branch.exitCode === 0 ? 'done' : 'failed';
      branch.tail       = tail.text;
      await flushBranchResults(collectFile, reportPath, branch.npmCommand);
      resolve();
    });
    child.on('error', async (err) => {
      branch.exitCode   = -1;
      branch.durationMs = Date.now() - branch.startedAt;
      branch.state      = 'failed';
      branch.tail       = `spawn error: ${err.message}`;
      await flushBranchResults(collectFile, reportPath, branch.npmCommand);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(X.EXCEL_PATH)) throw new Error(`Excel file not found: ${X.EXCEL_PATH}`);
  fs.mkdirSync(RUN_DIR, { recursive: true });

  let branches = filterByOnly(dedupedBranches(ALL_BRANCHES));
  if (branches.length === 0) {
    throw new Error(`No branches matched${ONLY ? ` --only=${ONLY.join(',')}` : ''}.`);
  }

  // Validate npm commands exist in package.json (warning only)
  const pkg = (() => { try { return require('./package.json'); } catch (_) { return { scripts: {} }; } })();
  const missingScripts = branches
    .map(b => (b.npmCommand.match(/^npm\s+run\s+(\S+)/i) || [])[1])
    .filter(n => n && !pkg.scripts[n]);
  if (missingScripts.length > 0) {
    console.warn('[parallel] WARNING: These scripts are missing from package.json:\n' +
      missingScripts.map(s => '  npm run ' + s).join('\n'));
  }

  // ── DRY RUN ───────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    const mode = HEADED ? 'HEADED 🖥' : 'HEADLESS';
    console.log(`\n${border}`);
    console.log(`  PARALLEL DRY-RUN (${mode}) — ${branches.length} branch(es) would launch:`);
    console.log(divider);
    console.log(`  ${'#'.padEnd(4)} ${'CONCEPT'.padEnd(18)} ${'NPM COMMAND'.padEnd(42)} ${'SPEC FILE'.padEnd(45)} IDs`);
    console.log(divider);
    branches.forEach((b, i) => {
      const pw = buildPlaywrightCmd(b);
      console.log(`  [${String(i + 1).padStart(2)}] ${b.concept.padEnd(18)} ${b.npmCommand.padEnd(42)} ${b.spec.padEnd(45)} ${b.ids || ''}`);
      console.log(`       📋 Playwright cmd: ${pw}`);
    });
    console.log(border);
    console.log(`\n  To run headed (default):   node run-parallel-tests.js`);
    console.log(`  To run headless:           node run-parallel-tests.js --headless`);
    console.log(`  To run a subset:           node run-parallel-tests.js --only=kpi,fp,rtc,chat`);
    console.log(border + '\n');
    return 0;
  }

  // ── LIVE RUN ──────────────────────────────────────────────────────────────
  for (const b of branches) b.state = 'pending';

  const report = await X.createReport({
    npmCommand: `npm run test:parallel${ONLY ? ' --only=' + ONLY.join(',') : ''}${HEADLESS ? ' --headless' : ''}`,
  });
  const REPORT_PATH = report.path;

  const mode = HEADED ? 'HEADED 🖥  (browser windows will open)' : 'HEADLESS';
  console.log(`\n${border}`);
  console.log(`  PARALLEL PLAYWRIGHT EXECUTION — ${mode}`);
  console.log(divider);
  console.log(`  Branches  : ${branches.length}`);
  console.log(`  Report    : ${REPORT_PATH}`);
  if (ONLY) console.log(`  Filter    : --only=${ONLY.join(',')}`);
  console.log(divider);

  // Print the full command table once at start so it's easy to see what's running
  branches.forEach((b, i) => {
    const pw = buildPlaywrightCmd(b);
    console.log(`  [${String(i + 1).padStart(2)}] ${b.concept.padEnd(18)} ${b.npmCommand.padEnd(42)} ${b.ids || ''}`);
    console.log(`       📋 ${pw}`);
  });
  console.log(border + '\n');

  // Handle Ctrl+C
  let interrupted = false;
  process.on('SIGINT', () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log('\n[parallel] SIGINT – killing all running branches…');
    for (const b of branches) {
      if (b.state === 'running' && b.child) {
        try { b.child.kill('SIGTERM'); } catch (_) {}
      }
    }
  });

  // Prepare per-branch collect files
  const collectFiles = branches.map((b, i) => path.join(RUN_DIR, `parallel-results-${i + 1}.json`));
  for (const cf of collectFiles) { try { fs.unlinkSync(cf); } catch (_) {} }

  // Status board refresh every 3 s
  const boardInterval = setInterval(() => printBoard(branches), 3000);

  // Launch all branches simultaneously
  const promises = branches.map((b, i) => launchBranch(b, collectFiles[i], REPORT_PATH));
  await Promise.all(promises);

  clearInterval(boardInterval);
  printBoard(branches);

  // Finalize Excel summary
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(REPORT_PATH);
    const allFailed = branches.every(b => b.state === 'failed');
    report.info.status    = interrupted ? 'INTERRUPTED' : allFailed ? 'FAILED' : 'COMPLETED';
    report.info.endedText = new Date().toLocaleString();
    X.writeSummary(wb, report.info);
    await X.saveWorkbook(wb, REPORT_PATH);
  } catch (err) {
    console.warn('[parallel] Could not finalize summary:', err.message);
  }

  // Final summary
  let totalFailed = 0;
  console.log(`\n${border}`);
  console.log('  PARALLEL EXECUTION — FINAL SUMMARY');
  console.log(divider);
  console.log(`  ${'RESULT'.padEnd(8)} ${'EXIT'.padEnd(6)} ${'DUR'.padEnd(7)} ${'CONCEPT'.padEnd(18)} ${'NPM COMMAND'.padEnd(42)} IDs`);
  console.log(divider);
  for (const b of branches) {
    const icon = b.state === 'done' ? '✅ PASS' : '❌ FAIL';
    const dur  = b.durationMs != null ? `${Math.round(b.durationMs / 1000)}s` : '—';
    console.log(`  ${icon.padEnd(8)} [${String(b.exitCode).padStart(3)}]  ${dur.padEnd(6)} ${b.concept.padEnd(18)} ${b.npmCommand.padEnd(42)} ${b.ids || ''}`);
    if (b.state === 'failed' && b.tail) {
      const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*m/g, '');
      const last = stripAnsi(b.tail).split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 260);
      console.log(`         💬 ${last}`);
    }
    if (b.state === 'failed') totalFailed++;
  }
  console.log(divider);
  console.log(`  Mode    : ${HEADED ? 'HEADED' : 'HEADLESS'}`);
  console.log(`  Report  : ${REPORT_PATH}`);
  console.log(`  Result  : ${branches.length - totalFailed} / ${branches.length} branches passed`);
  console.log(border + '\n');

  if (process.env.EXCEL_AUTO_OPEN !== 'false') {
    try { await X.openFile(REPORT_PATH); } catch (_) {}
  }

  return interrupted ? 130 : totalFailed > 0 ? 1 : 0;
}

main().then(
  code => process.exit(code),
  err  => { console.error(`\n[run-parallel-tests] ${err.message}`); process.exit(2); }
);
