# Admin Dashboard KPI validation

Extends the existing project (nothing existing was rebuilt or renamed) with
independent validation of the 4 Admin Dashboard KPI cards: **IT Staff MTTR**,
**AI MTTR**, **IT Staff First Contact Resolution**, and **IT Staff On Leave
Today**.

## Run it

```bash
npm run test:admin:kpi
```

No separate command for Excel - results land in `ITSM_2_0_Test_Cases.xlsx`
in real time as part of this same run, exactly like the rest of the suite.

## Files created

- `utils/date-time.js` - timestamp parsing (ISO, `MM/DD/YYYY hh:mm AM/PM`,
  and `Mon DD, YYYY, hh:mm AM/PM`) and duration math (ms/minutes/hours). No
  date utility existed in the project before this.
- `utils/kpi-calculator.js` - pure calculation functions, no UI code:
  `calculateItStaffMttr`, `calculateAiMttr`, `calculateItStaffFcr`,
  `calculateItStaffOnLeave`. Each KPI has its own logic, per the requirement
  that not all four use the same calculation - the two MTTR variants average
  ticket durations, FCR is a percentage, and On Leave is a headcount, not a
  duration metric at all.
- `utils/kpi-excel-writer.js` - appends to two new sheets, `KPI Results`
  (one row per KPI per run: name/dashboard value/calculated value/
  difference/status/ticket count/execution time) and `KPI Ticket Data` (one
  row per ticket actually processed, for debugging - kept separate from the
  calculated results per the "keep raw data separate for debugging"
  requirement). Both sheets are created on first run and appended to on every
  run after that; no existing sheet is touched, and this does not go through
  `excel-sync-reporter.js`/`test-id-map.js` (that mechanism fits "one Excel
  row = one pre-defined Test ID"; this is an aggregate comparison plus a
  growing log, so it gets its own small writer using the same
  read → modify → save-immediately pattern).
- `pages/KpiDashboardPage.js` - `getKpiValue(kpiName)`, `clickKpi(kpiName)`,
  `returnToAdminDashboard()`, `waitForDashboard()`.
- `pages/KpiTicketPage.js` - `getAllTicketIds()` (handles pagination and
  infinite scroll), `getNextUnprocessedTicket(processedIds)`,
  `openTicket(ticketId)`, `getTicketLifecycleData(ticketId, kpiCategory)`,
  and `getStaffOnLeaveEntries()` for the headcount KPI.
- `tests/admin/kpi-validation.spec.js` - one Playwright test per KPI (so one
  KPI failing doesn't stop the others - matches "continue with the next test
  case unless critical error"), sharing one reusable `collectKpiTicketData()`
  traversal helper.

## Files modified

- `fixtures/admin.fixture.js` - added `kpiDashboardPage` and `kpiTicketPage`
  fixtures (same pattern as the existing `aiHelpdeskPage` fixture). Nothing
  else in the fixture changed.
- `package.json` - added the `test:admin:kpi` script. No existing script
  changed.

Nothing else was touched - existing tests, the existing Excel reporter, and
every other page object are unchanged.

## Two-phase ticket processing (`utils/kpi-traversal.js`)

Used by IT Staff MTTR, AI MTTR and IT Staff First Contact Resolution. Each KPI
gets its **own** independent index (starting at 1); lists are never shared.

**Phase 1 - discover and index (no ticket is opened)**
1. Capture the KPI's dashboard value, click the KPI, wait for the list.
2. Collect every ticket ID (all pages via "Next", and infinite scroll until no
   new IDs appear). Duplicates are dropped with a `Set` and logged.
3. Build `[{ index, ticketId, status: 'pending' }]` once - never regenerated.
4. Write every ticket to the `KPI Ticket Data` sheet as `PENDING`.

**Phase 2 - process by index, identify by Ticket ID**
For each index in order: explicit Admin Dashboard navigation (never
`goBack()`) -> click the same KPI -> find the **exact** Ticket ID (boundary-safe,
so `INC-001` can't match `INC-0010`; pages/scrolls if it isn't on screen) ->
open it -> **verify the opened ticket ID equals the expected one** (mismatch =
stop that ticket, write no times, mark FAILED, message "Ticket mismatch
detected. Expected / Opened / Index") -> wait for load + a 4-5 s render wait
(`KPI_TICKET_RENDER_WAIT_MS`, default 5000, minimum 4000) -> wait for the
Lifecycle Timeline & Activity History heading, scroll to it -> wait for the
opening and closing timestamps to be visible -> extract -> compute duration ->
write the row to Excel immediately (`PROCESSED`) -> mark the index processed.
A missing timestamp is never calculated: the ticket is recorded `FAILED` with
the reason.

The index only controls order; the Ticket ID is the identity. No `nth()`
position is used to identify a ticket.

## Duplicate prevention and final validation
- Unique during discovery (`Set`), one stable index per ID.
- Processed once (status check before each ticket).
- Excel rows are upserted by (KPI, Ticket ID), so a ticket can't appear twice.
- After each KPI: discovered == processed == Excel PROCESSED records. If not,
  the KPI is reported `Incomplete` and the test fails with e.g. "Only 6 of 8
  tickets were successfully processed."

## KPI calculation, and the dashboard-vs-calculated comparison

Each KPI's own function in `kpi-calculator.js` takes the raw collected ticket
(or staff) data and returns `{ value, unit, ticketCount, incompleteCount,
incompleteReasons }`. `compareAndReport()` in the spec then:

1. Parses the dashboard's displayed value to a number.
2. Compares it to the calculated value (no arbitrary tolerance - the project
   has no documented rounding rule for these KPIs to derive one from; see the
   "Formula provenance" note below).
3. Logs `KPI / Tickets Processed / Dashboard Value / Calculated Value /
   Difference / Result` to the console, in the format requested.
4. Writes the same to the `KPI Results` sheet.
5. Asserts pass/fail - a KPI that couldn't be calculated at all (zero valid
   tickets) is reported as `Incomplete`, not silently skipped.

## ⚠️ Formula and selector provenance - please confirm

Two things in this feature are best-effort, not verified against your actual
application, and should be reviewed before you trust the results:

1. **KPI formulas**: no existing MTTR/SLA/FCR formula or spec was found
   anywhere in the project (searched for those terms plus "lifecycle",
   "timeline", "resolution time" across every file). `kpi-calculator.js`
   uses the standard, widely-used ITSM definitions (MTTR = mean of
   `closingTime - openingTime`; FCR = % resolved without a
   reassignment/escalation event; On Leave = headcount). If your actual
   formulas differ - business-hours-only MTTR, a different FCR definition,
   excluding certain statuses - update the relevant function in
   `kpi-calculator.js` only; nothing else needs to change.
2. **Selectors**: I don't have access to the live application, so the KPI
   card, ticket list, and Lifecycle Timeline selectors in
   `KpiDashboardPage.js` / `KpiTicketPage.js` are intentionally loose
   role/text-based patterns (not `nth-child`/class selectors, per your
   selector guidance) rather than ones verified against the real DOM. The
   very first run will likely need one or two of these patterns widened -
   each is isolated in one named constant/regex/locator with a comment
   explaining what to adjust and where, so a failed run should point
   directly at the one line to fix.
