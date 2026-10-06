# Per-run Excel report (current behaviour)

Every `npm run ...` execution writes its own report: `test-results/excel/ITSM_Test_Report_<YYYY-MM-DD_HH-mm-ss>.xlsx`.
The master `ITSM_2_0_Test_Cases.xlsx` is only a template - it is read, never modified.

- At start every test case's **Result** (column G) is `NOT EXECUTED`; Actual Result / Execution time are cleared; column H is kept.
- After **each** test finishes its row(s) become `PASS` or `FAIL` and the file is saved immediately (atomic write, queued, retried).
- Retries rewrite the same row, so the last attempt is the final result. Skipped tests and tests cut off mid-run stay `NOT EXECUTED`.
- Ctrl+C / SIGTERM / Playwright errors / uncaught exceptions flush the report. The `Execution Summary` sheet shows
  `COMPLETED`, `INTERRUPTED` or `CRASHED` (a hard kill leaves `RUNNING`; all finished results are still in the file).
- `npm run test:all-sequential` creates one report for the whole run; `-- --resume` continues the newest report.
- Reports live in `test-results/excel/`; Playwright artifacts moved to `test-results/artifacts/` (`outputDir`) so Playwright
  never wipes the reports at the start of a run.

---

# Excel ⇄ Playwright Live Sync

This project is connected to **`ITSM_2_0_Test_Cases.xlsx`** (kept at the project root). Every
`npm run test...` command updates that file automatically, live, as tests execute — you don't
run anything extra.

## How it works

1. `playwright.config.js` registers a custom reporter: `./reporter/excel-sync-reporter.js`
   (alongside the existing `list` and `html` reporters). Because it's on the shared config, it
   fires no matter which npm script you run — `npm test`, `npm run test:admin:tickets`,
   `npm run test:smoke`, etc.
2. `reporter/test-id-map.js` is the map of **which spec file covers which Excel Test IDs**
   (e.g. `tests/admin/ticket-queue.spec.js` → every `TQ-xx` row, plus `ITSM-04`).
3. As each test finishes (`onTestEnd`), the reporter looks up its matches in that map, updates
   the matching rows' **Result**, **Actual Result**, and **Execution Date/Time** columns, and
   **saves the workbook to disk immediately** — so the file on disk reflects live progress, not
   just a final summary.
4. Only the rows covered by the spec file(s) you actually ran get touched. Run
   `npm run test:admin:tickets` and only the `TQ-*` rows change; run `npm test` (the whole suite)
   and everything with automated coverage updates.
5. When the run finishes, the reporter opens `ITSM_2_0_Test_Cases.xlsx` for you automatically
   (Excel on Windows/Mac, or your default spreadsheet app on Linux) instead of printing the
   Playwright "npx playwright show-report" tip — the HTML reporter has been removed from
   `playwright.config.js` for that reason. To turn auto-open off (e.g. on a headless CI box),
   set `EXCEL_AUTO_OPEN=false`.

## Setup

```bash
npm install          # installs Playwright + exceljs (already added to package.json)
npx playwright install   # installs browsers, if you haven't already
npm test              # run everything; watch ITSM_2_0_Test_Cases.xlsx update as it goes
```

Optional: point at a different copy of the workbook via an environment variable:
```bash
EXCEL_RESULTS_PATH=/path/to/other-copy.xlsx npm test
```

## New Excel columns

Three columns were added to **Admin / Employee / IT Staff Test Cases**:

| Column | What it means |
|---|---|
| **NPM Command** | The exact `npm run ...` command that exercises this row. Rows with no automated test yet show `Not automated yet (manual)`. |
| **Regression Testing** | `Yes` if this row is covered by one of the `type1-all-in-one` specs — the full, continuous end‑to‑end journey per role (login → every module → done, no logout). |
| **System Testing** | `Yes` if this row is covered by an isolated, single-feature spec (e.g. just Ticket Queue, just Alert Management). |

A row can be `Yes`/`Yes` if both an isolated spec and the full journey touch it — that's expected;
whichever one you last ran is what the **Result** / **Actual Result** / **Execution Date/Time**
columns will reflect (last run wins, which is what "live" means here).

The **Result** cell and the new **Regression/System Testing** cells are also proper Excel
dropdowns (Result: `Passed / Failed / Blocked / Not Run / Pending`; the two new columns:
`Yes / No`) so you can edit them by hand too, e.g. for the manual‑only rows.

## Current automated coverage

| Prefix(es) | Sheet | Automated? | Command(s) |
|---|---|---|---|
| ITSM-01/02/03 | Admin | ✅ | `npm run test:smoke` |
| ITSM-04, TQ | Admin | ✅ | `npm run test:admin:tickets`, `npm run test:admin:type1` |
| LM | Admin | ✅ | `npm run test:admin:leaves`, `npm run test:admin:type1` |
| AM | Admin | ✅ | `npm run test:admin:alerts`, `npm run test:admin:type1` |
| UM | Admin | ✅ | `npm run test:admin:users`, `npm run test:admin:type1` |
| KB, ISM | Admin | ❌ not automated yet | — |
| ED | Employee | ✅ | `npm run test:employee:dashboard`, `npm run test:employee:type1` |
| EMT | Employee | ✅ | `npm run test:employee:tickets`, `npm run test:employee:type1` |
| ITD | IT Staff | ✅ | `npm run test:itstaff:dashboard`, `npm run test:itstaff:type1` |
| ITS-TQ | IT Staff | ✅ | `npm run test:itstaff:tickets`, `npm run test:itstaff:type1` |
| AC, LR | IT Staff | ❌ not automated yet | — |
| AIHD-ADM, AIHD-EMP, AIHD-ITS | **AI Helpdesk Test Cases** (new sheet) | ✅ | `npm run test:admin:ai-helpdesk`, `npm run test:employee:ai-helpdesk`, `npm run test:itstaff:ai-helpdesk`, or all three together via `npm run test:ai-helpdesk:all` |

`tests/admin/dashboard.spec.js`, `settings.spec.js`,
`ai-intelligence-check.spec.js`,
`tests/auth/forgot-password.spec.js`, `tests/realtime/*`, and `tests/e2e/*` all run and are
reported in the normal Playwright HTML report — they just don't have a clean 1:1 Excel Test ID
yet, so they don't write into the sheet. Add an entry to `reporter/test-id-map.js` any time you
want to wire one of them in (or add new manual rows/prefixes for KB, ISM, AC, LR and map them
once those areas get automated).

## AI Helpdesk chatbot tests are now Excel-driven

`tests/admin/ai-helpdesk.spec.js`, `tests/employee/ai-helpdesk.spec.js`, and
`tests/it-staff/ai-helpdesk.spec.js` no longer run one hardcoded scenario each. Instead:

- `global-setup.js` (wired into `playwright.config.js`'s `globalSetup`, so it runs automatically -
  no separate command) reads the **AI Helpdesk Test Cases** sheet, in the exact row order the
  rows appear in Excel, into `test-data/ai-helpdesk-excel-cases.generated.json`.
- Each spec file reads that JSON at load time, filters to its own `Dashboard` column value
  (`Admin` / `Employee` / `IT Staff`), and generates one `test()` per row, in that same order.
  Add, remove, or reorder rows in Excel and the next run picks it up automatically.
- The **Expected Resolution Behavior** column decides pass/fail: if it says the chatbot may
  legitimately decline (contains "decline"/"out of scope"/"may not resolve"), the test passes on
  either a real resolution or an explicit decline; otherwise only a real resolution passes.
- `utils/llm-agent.js` now detects an explicit decline (e.g. "I cannot resolve this", "I don't
  have enough information", "I am unable to assist", "I don't know how to resolve this" — matched
  by pattern, not one hardcoded string) and stops the conversation immediately instead of forcing
  another follow-up demanding a resolution.
- Results still land in Excel in real time, one row at a time, through the same
  `excel-sync-reporter.js` used everywhere else — `reporter/test-id-map.js` maps these files to
  the `AIHD-ADM` / `AIHD-EMP` / `AIHD-ITS` prefixes. The reporter now also prefers a richer,
  behavior-specific message (via a `testInfo.annotations.push({ type: 'excel-actual-result', ... })`
  call in the test) over its generic "<title> - <status>" fallback, so the Actual Result cell says
  *what the chatbot actually did*, not just pass/fail.

Note: this replaced the old `ED-058…062, ED-070` mapping for
`tests/employee/ai-helpdesk.spec.js` — those rows were UI-visibility checks that never really
matched what that spec tested (a multi-turn conversation), and are now mapped to the correct
`AIHD-EMP-*` rows instead. Those UI checks stay in the Employee sheet as manual/unmapped rows.

## Extending the mapping

Open `reporter/test-id-map.js` and add an entry:

```js
{
  file: 'tests/admin/settings.spec.js',
  sheet: 'Admin Test Cases',
  ids: ['SET-001', 'SET-002'],   // explicit IDs...
  prefixes: ['SET'],              // ...or a whole prefix, or both
  npmCommand: 'npm run test:admin:settings',
  category: 'System',             // or 'Regression' / 'Smoke'
}
```

That's the only file you need to touch — the reporter re-scans the workbook's Test ID column at
run time, so new rows/prefixes are picked up automatically.

## Sequential runner — `npm run test:all-sequential`

One command that runs **every NPM command listed in the Excel `NPM Command` column, one at a time**,
and finishes the Excel update for command N before command N+1 starts.

```bash
npm run test:all-sequential                     # full run, all commands, Excel order
npm run test:all-sequential -- --resume         # skip commands whose rows already have a Result
npm run test:all-sequential -- --dry-run        # list commands + rows each will update, run nothing
npm run test:all-sequential -- --only=admin     # only commands containing "admin" (comma-separated)
```

Per command: `run → wait for exit → collect results → update Excel → atomic save → re-read file and verify → next`.

- **Command list** is read from the Test-Case sheets (`Admin`, `Employee`, `IT Staff`, `AI Helpdesk`), split on commas,
  de-duplicated, original order kept. Nothing is hardcoded. `Not automated yet (manual)` rows are ignored.
- **Rows updated** for a command = rows that list that command in `NPM Command` **and** are covered by
  `reporter/test-id-map.js`. Other rows are never touched. If a test title starts with a Test ID
  (e.g. `AIHD-EMP-01: …`) only that row is updated instead of every row sharing the prefix.
- **Single writer:** while the runner executes a command, `excel-sync-reporter.js` runs in *collect-only* mode
  (`EXCEL_COLLECT_FILE` is set) and never opens the workbook. The runner then reloads the workbook fresh
  (so KPI sheets written by the command are preserved), applies the results, saves via temp file + atomic rename
  under a lock file, and re-reads the saved file to confirm every cell landed.
- **Result values:** `PASS`, `FAIL`, `SKIPPED` (Result dropdown extended to include them; legacy values stay valid).
- **Failures:** failed tests → `FAIL` + error in *Actual Result*; the run continues. If a command dies before
  reporting (bad spec, missing script, config error) its mapped rows are marked `FAIL` with the reason.
  The run **stops** only for (a) missing browsers/modules (Excel left untouched) or (b) Excel cannot be saved/verified
  (e.g. workbook open in Excel on Windows — close it and use `--resume`).
- **Resume:** a command counts as complete when every row it can update has a Result in Excel. A command is only
  written to Excel after it has fully exited, so a half-run command is never marked done.
- **Exit code:** `0` all clean, `1` some tests/commands failed, `2` aborted (infra/Excel), `130` interrupted.
- Scratch files live in `.sequential-run/` (git-ignored); `last-run.json` holds the last summary.

Notes: some rows list two commands (e.g. `…:dashboard` and `…:type1`). Both run; the later one overwrites the
earlier one's result for shared rows ("last run wins", as before). KPI commands (`test:admin:kpi`) are not in the
`NPM Command` column, so the sequential runner does not run them — run them separately as before.
