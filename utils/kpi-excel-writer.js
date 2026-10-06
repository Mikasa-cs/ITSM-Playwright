// @ts-check
// ---------------------------------------------------------------------------
// Excel output for KPI validation. Extends the existing workbook with two
// sheets (existing sheets and excel-sync-reporter.js are untouched):
//
//   "KPI Ticket Data" - one row per (KPI, Ticket ID). Rows are UPSERTED by that
//                       key, so a ticket can never appear twice for a KPI. After
//                       discovery every indexed ticket is written as PENDING and
//                       then updated in place to PROCESSED / FAILED as it's
//                       handled, i.e. the sheet fills in live during the run.
//   "KPI Results"     - one summary row per KPI per run (history is kept).
//
// Every call is read -> modify -> save immediately, serialized through a queue.
// ---------------------------------------------------------------------------
const path = require('path');
const ExcelJS = require('exceljs');

const EXCEL_PATH = process.env.EXCEL_RESULTS_PATH || path.join(__dirname, '..', 'ITSM_2_0_Test_Cases.xlsx');

const RESULTS_SHEET = 'KPI Results';
const RESULTS_HEADERS = [
  'KPI Name', 'Total Ticket Count', 'Processed Ticket Count', 'Dashboard Value',
  'Calculated Value', 'Difference', 'Status', 'Execution Date/Time', 'Notes',
];

const TICKET_SHEET = 'KPI Ticket Data';
const TICKET_HEADERS = [
  'KPI Name', 'Ticket Index', 'Ticket ID', 'Opening Time', 'Closing/Resolution Time',
  'Duration', 'Processing Status', 'Execution Timestamp', 'Reassigned/Escalated', 'Details',
];
const COL = { kpi: 1, index: 2, id: 3, open: 4, close: 5, duration: 6, status: 7, ts: 8, reassigned: 9, details: 10 };

let writeQueue = Promise.resolve();

function headersMatch(ws, headers) {
  const vals = ws.getRow(1).values || [];
  return headers.every((h, i) => String(vals[i + 1] || '').trim() === h);
}

/** Create the sheet / fix its header. An older-layout sheet is renamed (never deleted) so no data is lost. */
function prepareSheet(workbook, name, headers) {
  let ws = workbook.getWorksheet(name);
  if (ws && !headersMatch(ws, headers)) {
    if (ws.rowCount > 1) {
      ws.name = `${name} (old ${Date.now() % 100000})`.slice(0, 31);
      ws = undefined;
    } else {
      workbook.removeWorksheet(ws.id);
      ws = undefined;
    }
  }
  if (!ws) {
    ws = workbook.addWorksheet(name);
    const row = ws.getRow(1);
    headers.forEach((h, i) => { row.getCell(i + 1).value = h; });
    row.font = { bold: true };
    row.commit();
    ws.columns.forEach((c) => { c.width = 24; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  return ws;
}

function withWorkbook(fn) {
  const run = async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_PATH); // throws a clear error if the file is missing/locked - not swallowed
    const resultsWs = prepareSheet(workbook, RESULTS_SHEET, RESULTS_HEADERS);
    const ticketWs = prepareSheet(workbook, TICKET_SHEET, TICKET_HEADERS);
    const out = await fn({ workbook, resultsWs, ticketWs });
    await workbook.xlsx.writeFile(EXCEL_PATH);
    return out;
  };
  const p = writeQueue.then(run, run);
  writeQueue = p.catch(() => {});
  return p;
}

function findTicketRow(ws, kpiName, ticketId) {
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (row.getCell(COL.kpi).value === kpiName && row.getCell(COL.id).value === ticketId) return row;
  }
  return null;
}

/**
 * Insert or update the single row for (kpiName, ticketId). Never creates a duplicate.
 * @param {Object} t
 * @param {string} t.kpiName @param {number} t.index @param {string} t.ticketId
 * @param {string} t.status  'PENDING' | 'PROCESSED' | 'FAILED'
 * @param {string} [t.openingTime] @param {string} [t.closingTime]
 * @param {number} [t.durationMinutes] @param {boolean} [t.reassignedOrEscalated] @param {string} [t.details]
 */
async function upsertTicketRow(t) {
  await withWorkbook(async ({ ticketWs }) => {
    const row = findTicketRow(ticketWs, t.kpiName, t.ticketId) || ticketWs.addRow([]);
    const duration = typeof t.durationMinutes === 'number' ? `${Math.round(t.durationMinutes * 100) / 100} min` : '';
    row.getCell(COL.kpi).value = t.kpiName;
    row.getCell(COL.index).value = t.index;
    row.getCell(COL.id).value = t.ticketId;
    row.getCell(COL.open).value = t.openingTime || '';
    row.getCell(COL.close).value = t.closingTime || '';
    row.getCell(COL.duration).value = duration;
    row.getCell(COL.status).value = t.status;
    row.getCell(COL.ts).value = new Date().toLocaleString();
    row.getCell(COL.reassigned).value = t.reassignedOrEscalated === undefined ? '' : t.reassignedOrEscalated ? 'Yes' : 'No';
    row.getCell(COL.details).value = t.details || '';
    row.commit();
  });
}

/** Number of distinct Ticket IDs recorded as PROCESSED for a KPI (used for the final discovered == processed == Excel check). */
async function countProcessedTicketRows(kpiName) {
  return withWorkbook(async ({ ticketWs }) => {
    const ids = new Set();
    for (let r = 2; r <= ticketWs.rowCount; r++) {
      const row = ticketWs.getRow(r);
      if (row.getCell(COL.kpi).value === kpiName && row.getCell(COL.status).value === 'PROCESSED') ids.add(row.getCell(COL.id).value);
    }
    return ids.size;
  });
}

/** Append the KPI summary row (one per KPI per run). */
async function appendKpiResultRow({ kpiName, dashboardValue, calculatedValue, unit, ticketCount, totalTickets, processedCount, status, notes = '' }) {
  const dashNum = parseFloat(String(dashboardValue).replace(/[^\d.-]/g, ''));
  const diff = calculatedValue !== null && !isNaN(dashNum) ? Math.round((Math.abs(dashNum - calculatedValue) + Number.EPSILON) * 100) / 100 : null;
  await withWorkbook(async ({ resultsWs }) => {
    const row = resultsWs.addRow([
      kpiName,
      totalTickets !== undefined ? totalTickets : ticketCount,
      processedCount !== undefined ? processedCount : ticketCount,
      dashboardValue,
      calculatedValue === null ? 'N/A' : `${calculatedValue} ${unit}`,
      diff === null ? 'N/A' : `${diff} ${unit}`,
      status,
      new Date().toLocaleString(),
      notes,
    ]);
    row.commit();
  });
}

module.exports = { upsertTicketRow, countProcessedTicketRows, appendKpiResultRow, EXCEL_PATH, RESULTS_SHEET, TICKET_SHEET, RESULTS_HEADERS, TICKET_HEADERS };
