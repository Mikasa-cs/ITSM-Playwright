// ---------------------------------------------------------------------------
// excel-sync-reporter.js
//
// Every Playwright execution gets its own live Excel report:
//     test-results/excel/ITSM_Test_Report_<YYYY-MM-DD_HH-mm-ss>.xlsx
// built from the master ITSM_2_0_Test_Cases.xlsx (the master is only read, never modified).
//
// LIVE mode (default - every plain `npm run test...`):
//   onBegin  : copy the master, set every test case's Result to NOT EXECUTED, save.
//   onTestEnd: map the finished test to its Excel row(s) by Test ID (./test-id-map.js),
//              write PASS / FAIL (+ actual result + time) and SAVE IMMEDIATELY (atomic).
//   onEnd    : stamp the "Execution Summary" sheet COMPLETED / INTERRUPTED / CRASHED and save.
//   Ctrl+C / SIGTERM / uncaught errors also flush the report (see _installProcessHandlers).
//   Playwright runs reporters in the main process, so this is the single writer even with many
//   workers; writes are queued one after another, and a failed write is retried and never loses
//   results (the in-memory workbook always holds everything recorded so far).
//
// COLLECT mode (EXCEL_COLLECT_FILE set - used by run-all-tests.js):
//   The reporter does NOT touch Excel; it only records outcomes to that JSON file and the
//   orchestrator writes the (single, timestamped) report itself.
// ---------------------------------------------------------------------------
const fs = require('fs');
const X = require('./excel-utils');

const AUTO_OPEN = process.env.EXCEL_AUTO_OPEN !== 'false';
const COLLECT_FILE = process.env.EXCEL_COLLECT_FILE || '';
const SIGINT_FALLBACK_MS = 20_000; // Playwright normally shuts down by itself on Ctrl+C; force it if it hangs

class ExcelSyncReporter {
  constructor() {
    this.queue = Promise.resolve(); // serializes writes so concurrent onTestEnd calls can't corrupt the file
    this.workbook = null;
    this.reportPath = '';
    this.info = null;
    this.ready = false;
    this.updatedRows = 0;
    this.skippedNoCoverage = 0;
    this.crashed = false;
    this.signalled = '';
    this.records = new Map(); // collect mode: test.id -> record (last attempt wins)
    this.collectMode = !!COLLECT_FILE;
    this.handlers = [];
  }

  async onBegin() {
    if (this.collectMode) {
      this.ready = true;
      this._flushCollect('running');
      return;
    }
    try {
      require('exceljs');
    } catch (e) {
      console.warn(
        '[excel-sync-reporter] "exceljs" is not installed - Excel report is disabled.\n' +
          '                      Run "npm install" in this project (exceljs is in package.json) to enable it.'
      );
      return;
    }
    try {
      const r = await X.createReport();
      this.workbook = r.workbook;
      this.reportPath = r.path;
      this.info = r.info;
      this.ready = true;
      this._installProcessHandlers();
      console.log(`[excel-sync-reporter] Report created: ${this.reportPath}\n                      Every test result is saved to it the moment the test finishes.`);
    } catch (e) {
      console.warn(`[excel-sync-reporter] Could not create the Excel report - sync disabled. ${e.message}`);
    }
  }

  // ------------------------------ collect mode --------------------------------
  _toRecord(test, result) {
    const annotation = (test.annotations || []).find((a) => a.type === 'excel-actual-result');
    const idAnnotation = (test.annotations || []).find((a) => a.type === 'excel-test-id');
    return {
      file: test.location && test.location.file ? test.location.file.replace(/\\/g, '/') : '',
      title: test.title,
      status: result.status,
      retry: result.retry || 0,
      durationMs: result.duration,
      error: result.error && result.error.message ? String(result.error.message).slice(0, 2000) : '',
      actualResult: annotation && annotation.description ? annotation.description : '',
      testId: idAnnotation && idAnnotation.description ? idAnnotation.description : '',
      endedAt: new Date().toISOString(),
    };
  }

  _flushCollect(runStatus) {
    try {
      fs.writeFileSync(COLLECT_FILE, JSON.stringify({ runStatus, records: [...this.records.values()] }, null, 2));
    } catch (err) {
      console.warn('[excel-sync-reporter] could not write collect file:', err.message);
    }
  }

  // ------------------------------- live mode ----------------------------------
  /** Queue one unit of work (mutate workbook -> refresh summary -> atomic save, with retries). */
  _enqueue(mutate) {
    this.queue = this.queue
      .then(async () => {
        if (mutate) mutate();
        X.writeSummary(this.workbook, this.info);
        let lastErr;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await X.saveWorkbook(this.workbook, this.reportPath);
            return;
          } catch (err) {
            lastErr = err; // keep going: the in-memory workbook still holds every result recorded so far
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
        console.warn(`[excel-sync-reporter] Could not save the report yet (${lastErr.message}); results are kept and will be written on the next save.`);
      })
      .catch((err) => console.warn('[excel-sync-reporter] unexpected report error:', err.message));
    return this.queue;
  }

  onTestEnd(test, result) {
    if (!this.ready) return;
    const record = this._toRecord(test, result);

    if (this.collectMode) {
      this.records.set(test.id, record); // retries: the last attempt is the outcome
      this._flushCollect('running');
      return;
    }

    // Retries: each attempt rewrites the SAME row(s), so the last attempt is the final result
    // (attempt 1 FAIL -> attempt 2 PASS ends as PASS). One Test ID = one row = one result.
    return this._enqueue(() => {
      const { matched, touched } = X.applyRecord(this.workbook, record);
      if (!matched) {
        this.skippedNoCoverage++;
        return;
      }
      if (touched.length) {
        this.updatedRows += touched.length;
        console.log(`[excel-sync-reporter] Saved "${test.title}" -> ${touched[0].result} (${touched.length} row(s))`);
      }
    });
  }

  onError(error) {
    if (!this.ready || this.collectMode) return;
    this.crashed = true;
    this.info.status = 'CRASHED';
    this.info.notes = `Playwright error: ${String((error && error.message) || error).split('\n')[0].slice(0, 300)}`;
    return this._enqueue();
  }

  _installProcessHandlers() {
    const on = (event, fn) => {
      process.on(event, fn);
      this.handlers.push([event, fn]);
    };
    const onSignal = (sig, code) => () => {
      this.signalled = sig;
      this.info.status = 'INTERRUPTED';
      this.info.notes = `Interrupted by ${sig}`;
      this._enqueue();
      if (sig === 'SIGTERM') {
        this.queue.finally(() => process.exit(code)); // nothing else will stop the process once we listen for SIGTERM
      } else {
        // Ctrl+C: Playwright shuts down gracefully by itself (and calls onEnd). Only force-exit if it hangs.
        setTimeout(() => this.queue.finally(() => process.exit(code)), SIGINT_FALLBACK_MS).unref();
      }
    };
    on('SIGINT', onSignal('SIGINT', 130));
    on('SIGTERM', onSignal('SIGTERM', 143));
    // Observe-only: Node still terminates after an uncaught exception, we just try to record it first.
    on('uncaughtExceptionMonitor', (err) => {
      this.crashed = true;
      this.info.status = 'CRASHED';
      this.info.notes = `Uncaught exception: ${String((err && err.message) || err).split('\n')[0].slice(0, 300)}`;
      this._enqueue();
    });
  }

  _removeProcessHandlers() {
    for (const [event, fn] of this.handlers) process.off(event, fn);
    this.handlers = [];
  }

  async onEnd(result) {
    if (this.collectMode) {
      this._flushCollect(result && result.status ? result.status : 'finished');
      return;
    }
    if (!this.ready) return;
    this._removeProcessHandlers();

    const pwStatus = result && result.status;
    this.info.status = this.crashed
      ? 'CRASHED'
      : this.signalled || pwStatus === 'interrupted' || pwStatus === 'timedout'
        ? 'INTERRUPTED'
        : 'COMPLETED';
    if (!this.info.notes && pwStatus === 'timedout') this.info.notes = 'Playwright global timeout reached';
    if (!this.info.notes && pwStatus === 'interrupted') this.info.notes = 'Run stopped before all tests executed';
    this.info.endedText = new Date().toLocaleString();
    await this._enqueue();
    const c = X.countResults(this.workbook);
    console.log(
      `[excel-sync-reporter] ${this.info.status}. PASS ${c.passed} | FAIL ${c.failed} | NOT EXECUTED ${c.notExecuted} (of ${c.total}).\n` +
        `                      Report: ${this.reportPath}`
    );

    if (AUTO_OPEN && this.updatedRows > 0) {
      try {
        await X.openFile(this.reportPath);
      } catch (err) {
        console.warn(`[excel-sync-reporter] Couldn't auto-open the report (${err.message}). It's at:\n  ${this.reportPath}`);
      }
    }
  }
}

module.exports = ExcelSyncReporter;
