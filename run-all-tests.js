#!/usr/bin/env node
// ---------------------------------------------------------------------------
// run-all-tests.js  -  sequential NPM-command runner with per-command Excel sync
//
//   npm run test:all-sequential                 full run (every command, in Excel order)
//   npm run test:all-sequential -- --resume     skip commands whose Excel rows already have results
//   npm run test:all-sequential -- --dry-run    list commands + the rows each one updates, run nothing
//   npm run test:all-sequential -- --only=admin run only commands containing this text (comma-separated)
//
// For EVERY command, strictly one after another:
//   run command -> wait for process exit -> collect results -> update Excel
//   -> save (atomic) -> verify from disk -> ONLY THEN start the next command.
//
// The command list is read from the "NPM Command" column of the Excel test
// sheets (unique, original order). Results reach Excel through
// reporter/excel-utils.js, the same mapping (reporter/test-id-map.js) the
// live reporter uses. While a command runs, the reporter is in collect-only
// mode, so this script is the single Excel writer.
// ---------------------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ExcelJS = require('exceljs');
const X = require('./reporter/excel-utils');

const ROOT = __dirname;
const RUN_DIR = path.join(ROOT, '.sequential-run');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const RESUME = flag('resume');
const DRY_RUN = flag('dry-run');
const ONLY = opt('only') ? opt('only').split(',').map((s) => s.trim()).filter(Boolean) : null;

const line = '='.repeat(50);
// Environment/setup problems that make every later command pointless too.
const INFRA_FATAL = /Executable doesn't exist|npx playwright install|Cannot find module '(@playwright\/test|playwright|playwright-core|exceljs)/i;

// The master workbook is only READ (for the command plan). All results go to ONE timestamped report
// in test-results/excel/ (created at the start of the run, reused by --resume).
let REPORT = null; // { path, info }
async function loadWorkbook(file = X.MASTER_PATH) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb;
}
const loadReport = () => loadWorkbook(REPORT.path);

/** Stamp the summary sheet and save the report (best effort - never throws). */
async function finalizeReport(status, notes) {
  if (!REPORT) return;
  try {
    const wb = await loadReport();
    REPORT.info.status = status;
    REPORT.info.endedText = new Date().toLocaleString();
    if (notes) REPORT.info.notes = notes;
    X.writeSummary(wb, REPORT.info);
    await X.saveWorkbook(wb, REPORT.path);
  } catch (err) {
    console.warn(`[run-all-tests] could not finalize the report: ${err.message}`);
  }
}

/** Runs one npm command to completion. Never rejects; resolves once the process has fully exited. */
function executeNpmCommand(command, collectFile) {
  return new Promise((resolve) => {
    const started = Date.now();
    let tail = '';
    const keep = (buf) => {
      tail = (tail + buf.toString()).slice(-6000);
    };
    const child = spawn(command, {
      cwd: ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EXCEL_COLLECT_FILE: collectFile, EXCEL_AUTO_OPEN: 'false' },
    });
    activeChild = child;
    child.stdout.on('data', (d) => {
      process.stdout.write(d);
      keep(d);
    });
    child.stderr.on('data', (d) => {
      process.stderr.write(d);
      keep(d);
    });
    child.on('error', (err) => {
      activeChild = null;
      resolve({ exitCode: -1, tail: `spawn error: ${err.message}`, durationMs: Date.now() - started });
    });
    child.on('close', (code, signal) => {
      activeChild = null;
      resolve({ exitCode: code === null ? -1 : code, signal, tail, durationMs: Date.now() - started });
    });
  });
}
let activeChild = null;
let interrupted = false;
process.on('SIGINT', () => {
  if (interrupted) process.exit(130); // second Ctrl+C: leave immediately
  interrupted = true;
  console.log('\n[run-all-tests] Interrupted - stopping the running command and saving the report. Press Ctrl+C again to force quit; use --resume to continue.');
  if (activeChild) activeChild.kill();
});

function collectResults(collectFile) {
  try {
    return JSON.parse(fs.readFileSync(collectFile, 'utf8')).records || [];
  } catch (_) {
    return [];
  }
}

function tally(records) {
  const t = { tests: records.length, passed: 0, failed: 0, skipped: 0 };
  for (const r of records) {
    if (r.status === 'passed') t.passed++;
    else if (r.status === 'skipped') t.skipped++;
    else t.failed++; // failed / timedOut / interrupted
  }
  return t;
}

/** Best one-line explanation of why a command died: first "...Error:" / npm ERR / Missing script line, else the last output lines. */
function lastLines(text, n = 4) {
  const lines = X.stripAnsi(text).split('\n').map((s) => s.trim()).filter(Boolean);
  const hit = lines.find((l) => /^(\w*Error\b|npm (ERR|error)|Missing script|Error:)/.test(l));
  return (hit ? lines.slice(lines.indexOf(hit), lines.indexOf(hit) + 2) : lines.slice(-n)).join(' | ').slice(0, 300);
}

/** A command is complete when every row it can update already has a Result. */
function isCompleted(workbook, command) {
  const rows = X.mappedRowsForCommand(workbook, command);
  return rows.length > 0 && rows.every((r) => {
    const v = X.cellText(r.row.getCell(r.cols.result));
    return v !== '' && v.toUpperCase() !== X.RESULT.NOT_EXECUTED;
  });
}

async function main() {
  if (!fs.existsSync(X.EXCEL_PATH)) throw new Error(`Excel file not found: ${X.EXCEL_PATH}`);
  fs.mkdirSync(RUN_DIR, { recursive: true });

  // Only one orchestrator may run at a time (it is the single Excel writer).
  const releaseRunLock = DRY_RUN ? () => {} : await X.acquireLock(path.join(RUN_DIR, 'run.lock'), 1000).catch(() => {
    throw new Error('Another run-all-tests.js is already running (.sequential-run/run.lock).');
  });

  try {
    const planWb = await loadWorkbook();
    const plan = X.readCommandPlan(planWb);
    let commands = plan.order;
    if (ONLY) commands = commands.filter((c) => ONLY.some((o) => c.includes(o)));
    if (commands.length === 0) throw new Error('No "npm run ..." commands found in the Excel NPM Command column' + (ONLY ? ' (after --only filter).' : '.'));

    const pkgScripts = (() => {
      try {
        return require('./package.json').scripts || {};
      } catch (_) {
        return {};
      }
    })();
    const scriptOf = (c) => (c.match(/^npm\s+run\s+(\S+)/i) || [])[1];

    console.log(`\n${line}\nSEQUENTIAL PLAYWRIGHT EXECUTION\n${line}`);
    console.log(`Excel master (read-only): ${X.MASTER_PATH}`);
    console.log(`Mode : ${DRY_RUN ? 'DRY RUN' : RESUME ? 'RESUME (skip completed commands)' : 'FULL (run every command)'}`);
    console.log(`Found ${commands.length} unique command(s) in Excel, original order preserved.\n`);

    if (DRY_RUN) {
      commands.forEach((c, i) => {
        const mapped = X.mappedRowsForCommand(planWb, c).length;
        const listed = plan.listedRows.get(c);
        const s = scriptOf(c);
        console.log(
          `[${i + 1}/${commands.length}] ${c}\n      Excel rows listing it: ${listed} | rows it will update: ${mapped}` +
            (listed !== mapped ? ` | ${listed - mapped} listed row(s) have no mapped test (left untouched)` : '') +
            (s && !pkgScripts[s] ? '\n      WARNING: script not found in package.json' : '') +
            (mapped === 0 ? '\n      WARNING: no entry in reporter/test-id-map.js - results cannot be written' : '')
        );
      });
      return 0;
    }

    // One timestamped report per orchestrated run (--resume continues the newest one).
    const latest = RESUME ? X.latestReport() : null;
    if (latest) {
      const wb = await loadWorkbook(latest);
      REPORT = { path: latest, info: X.readSummaryInfo(wb, latest) };
      console.log(`Report (resumed): ${latest}\n`);
    } else {
      const r = await X.createReport({ npmCommand: `npm run test:all-sequential${args.length ? ' -- ' + args.join(' ') : ''}` });
      REPORT = { path: r.path, info: r.info };
      console.log(`Report: ${r.path}\n`);
    }

    const summary = [];
    let completed = 0;
    let failedCommands = 0;
    let skippedCommands = 0;
    let fatal = null;

    for (let i = 0; i < commands.length; i++) {
      if (interrupted) break;
      const command = commands[i];
      const tag = `[${i + 1}/${commands.length}]`;

      if (RESUME) {
        const wb = await loadReport();
        if (isCompleted(wb, command)) {
          console.log(`${tag} ${command}\n      SKIPPED (already has results in Excel)\n`);
          skippedCommands++;
          summary.push({ command, skipped: true });
          continue;
        }
      }

      console.log(`\n${line}\n${tag} Starting: ${command}\n${line}`);
      const collectFile = path.join(RUN_DIR, `results-${i + 1}.json`);
      try {
        fs.unlinkSync(collectFile);
      } catch (_) {}

      // 1-2. run the command and wait until it has completely finished
      const run = await executeNpmCommand(command, collectFile);
      // (when interrupted we still record what the command had finished before it was stopped)

      // 3. collect results
      const records = collectResults(collectFile);
      const t = tally(records);

      if (records.length === 0 && run.exitCode !== 0 && INFRA_FATAL.test(run.tail)) {
        fatal = `Infrastructure/setup failure while running "${command}": ${lastLines(run.tail)}`;
        console.log(`\n${tag} ${command}\n      ${fatal}\n      Excel left untouched for this command.`);
        summary.push({ command, ...t, exitCode: run.exitCode, excel: 'NOT UPDATED', fatal: true });
        failedCommands++;
        break;
      }

      // 4-6. update Excel (fresh read so nothing written during the run is lost), save, verify
      let excelStatus;
      let updatedRows = 0;
      const notes = [];
      try {
        const wb = await loadReport();
        const touched = [];
        for (const rec of records) touched.push(...X.applyRecord(wb, rec, { command }).touched);

        // Rows this command owns that no test reported on:
        //   command exited non-zero  -> FAIL them with the reason
        //   command exited cleanly   -> leave untouched (just warn)
        const done = new Set(touched.map((r) => `${r.sheet}#${r.rowNumber}`));
        const uncovered = X.mappedRowsForCommand(wb, command).filter((r) => !done.has(`${r.ws.name}#${r.rowNumber}`));
        if (uncovered.length && run.exitCode !== 0 && !interrupted) {
          const why = records.length === 0
            ? `Command exited with code ${run.exitCode} before any test reported a result: ${lastLines(run.tail)}`
            : `Command exited with code ${run.exitCode} before this test reported a result: ${lastLines(run.tail)}`;
          touched.push(...X.markRows(uncovered, X.RESULT.FAIL, why));
        } else if (uncovered.length) {
          notes.push(`${uncovered.length} mapped row(s) received no test result (left untouched)`);
        }
        const unmapped = plan.listedRows.get(command) - X.mappedRowsForCommand(wb, command).length;
        if (unmapped > 0) notes.push(`${unmapped} listed row(s) have no mapped test (left untouched)`);

        X.writeSummary(wb, REPORT.info); // live counts in the Execution Summary sheet
        await X.saveWorkbook(wb, REPORT.path); // 5. save (atomic, single writer)
        const v = await X.verifyRows(touched, X.TEST_SHEETS.filter((n) => wb.getWorksheet(n)), REPORT.path); // 6. verify from disk
        if (!v.ok) throw new Error(`Excel verification failed: ${v.problems.slice(0, 5).join('; ')}`);
        updatedRows = touched.length;
        excelStatus = 'UPDATED ✓';
      } catch (err) {
        // Excel could not be saved/verified: continuing would break the "Excel first, then next command" guarantee.
        fatal = `Excel update failed after "${command}": ${err.message} (raw results kept in ${collectFile})`;
        excelStatus = 'FAILED ✗';
        summary.push({ command, ...t, exitCode: run.exitCode, excel: excelStatus });
        failedCommands++;
        console.log(`\n${tag} ${command}\n      Tests: ${t.tests}\n      Passed: ${t.passed}\n      Failed: ${t.failed}\n      Excel: ${excelStatus}\n      ${fatal}`);
        break;
      }

      const cmdFailed = t.failed > 0 || run.exitCode !== 0;
      if (cmdFailed) failedCommands++;
      completed++;
      summary.push({ command, ...t, exitCode: run.exitCode, rowsUpdated: updatedRows, excel: excelStatus, failed: cmdFailed });
      console.log(
        `\n${tag} ${command}\n      Tests: ${t.tests}\n      Passed: ${t.passed}\n      Failed: ${t.failed}\n      Skipped: ${t.skipped}\n` +
          `      Exit code: ${run.exitCode}\n      Excel: ${excelStatus} (${updatedRows} row(s))` +
          notes.map((n) => `\n      Note: ${n}`).join('') +
          `\n      Only now continuing to the next command...`
      );
    }

    fs.writeFileSync(path.join(RUN_DIR, 'last-run.json'), JSON.stringify({ finishedAt: new Date().toISOString(), summary }, null, 2));

    await finalizeReport(fatal ? 'CRASHED' : interrupted ? 'INTERRUPTED' : 'COMPLETED', fatal || (interrupted ? 'Interrupted by Ctrl+C' : ''));
    console.log(`\n${line}\nEXECUTION ${fatal ? 'ABORTED' : interrupted ? 'INTERRUPTED' : 'COMPLETE'}\n${line}`);
    console.log(`Report: ${REPORT.path}`);
    console.log(`Total Commands: ${commands.length}`);
    console.log(`Completed: ${completed}`);
    if (RESUME) console.log(`Skipped (already done): ${skippedCommands}`);
    console.log(`Failed Commands: ${failedCommands}`);
    const excelOk = !fatal && !summary.some((s) => s.excel === 'FAILED ✗');
    console.log(`Excel: ${excelOk ? 'Successfully Updated' : 'NOT fully updated - see message below'}`);
    if (fatal) console.log(`\n${fatal}`);
    console.log(line);

    if (excelOk && completed > 0 && process.env.EXCEL_AUTO_OPEN !== 'false') {
      try {
        await X.openFile(REPORT.path);
      } catch (err) {
        console.warn(`Couldn't auto-open the workbook (${err.message}). It's at: ${REPORT.path}`);
      }
    }
    return fatal ? 2 : interrupted ? 130 : failedCommands > 0 ? 1 : 0;
  } finally {
    releaseRunLock();
  }
}

main().then(
  (code) => process.exit(code),
  async (err) => {
    console.error(`\n[run-all-tests] ${err.message}`);
    await finalizeReport('CRASHED', err.message);
    process.exit(2);
  }
);
