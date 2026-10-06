// @ts-check
// ---------------------------------------------------------------------------
// Two-phase KPI ticket processing (reusable for every ticket-based KPI).
//
//   PHASE 1 - discoverAllKpiTickets(): open the KPI once, collect ALL ticket IDs
//             (every page / full scroll), open NO tickets, dedupe with a Set and
//             build a stable, 1-based indexed list. Never regenerated afterwards.
//   PHASE 2 - processIndexedTicket(): for each index in order - explicit Admin
//             Dashboard navigation (never browser back), re-click the same KPI,
//             find the EXACT Ticket ID, open it, verify the opened ID matches,
//             wait 4-5 s + for the Lifecycle Timeline, extract both timestamps,
//             compute the duration, write to Excel immediately, mark the status.
//
// The numeric index only controls processing ORDER; the Ticket ID is always the
// identity used to find and verify the ticket. Page objects and the Excel
// writer are injected so this logic can be unit-tested without a browser.
// ---------------------------------------------------------------------------
const { computeDuration } = require('./date-time');

class TicketMismatchError extends Error {}

/**
 * Convert raw discovered IDs into a stable indexed list. Duplicates are logged
 * and dropped (they never get a second index).
 * @param {string[]} rawIds
 * @returns {{ indexedTickets: Array<{index:number, ticketId:string, status:'pending'|'processed'|'failed'}>, duplicates: string[] }}
 */
function createIndexedTicketList(rawIds) {
  const seen = new Set();
  const duplicates = [];
  const indexedTickets = [];
  for (const id of rawIds) {
    if (seen.has(id)) {
      duplicates.push(id);
      continue;
    }
    seen.add(id);
    indexedTickets.push({ index: indexedTickets.length + 1, ticketId: id, status: 'pending' });
  }
  return { indexedTickets, duplicates };
}

/**
 * PHASE 1. Captures the dashboard value, opens the KPI, collects every ticket
 * ID (no ticket is opened) and indexes them. Every ticket is written to Excel
 * as PENDING so the sheet shows the full list before processing starts.
 */
async function discoverAllKpiTickets({ kpiDashboardPage, kpiTicketPage, kpiName, writer, log = console.log }) {
  await kpiDashboardPage.waitForDashboard();
  const dashboardValue = await kpiDashboardPage.getKpiValue(kpiName);
  log(`[${kpiName}] Dashboard value: "${dashboardValue}"`);

  await kpiDashboardPage.clickKpi(kpiName);
  await kpiTicketPage.waitForTicketList();
  const rawIds = await kpiTicketPage.getAllTicketIds();

  const { indexedTickets, duplicates } = createIndexedTicketList(rawIds);
  duplicates.forEach((d) => log(`[${kpiName}] Duplicate Ticket ID ignored during discovery: ${d}`));

  log(`\n==================================================`);
  log(`KPI: ${kpiName}`);
  log(`Total Tickets: ${indexedTickets.length}`);
  log(`==================================================`);
  indexedTickets.forEach((t) => log(`  ${t.index}  ${t.ticketId}`));

  for (const t of indexedTickets) {
    await writer.upsertTicketRow({ kpiName, index: t.index, ticketId: t.ticketId, status: 'PENDING' });
  }
  return { dashboardValue, indexedTickets, duplicates };
}

/**
 * PHASE 2 for a single indexed ticket. Never throws for a per-ticket problem:
 * the ticket is marked failed, recorded in Excel with the reason, and the
 * caller continues (nothing is silently skipped - the final validation fails
 * the KPI if any ticket failed).
 * @returns {Promise<import('./kpi-calculator').KpiTicketData>}
 */
async function processIndexedTicket({ kpiDashboardPage, kpiTicketPage, kpiName, ticket, total, writer, log = console.log }) {
  const { index, ticketId } = ticket;
  log(`\n[${index}/${total}]`);
  log(`Ticket ID: ${ticketId}`);

  /** @type {import('./kpi-calculator').KpiTicketData} */
  let data = { ticketId, kpiCategory: kpiName, openingTime: '', closingTime: '' };
  try {
    log('Returning to Admin Dashboard...');
    await kpiDashboardPage.returnToAdminDashboard();
    log(`Reopening ${kpiName}...`);
    await kpiDashboardPage.clickKpi(kpiName);
    await kpiTicketPage.waitForTicketList();

    log('Opening ticket...');
    await kpiTicketPage.openTicketById(ticketId);

    // Verify we opened the ticket we meant to BEFORE reading anything from it.
    const opened = await kpiTicketPage.getOpenedTicketId();
    if (opened !== ticketId) {
      throw new TicketMismatchError(`Ticket mismatch detected.\nExpected: ${ticketId}\nOpened: ${opened || '(none found)'}\nIndex: ${index}`);
    }

    log('Waiting for ticket page...');
    log('Waiting 4-5 seconds...');
    await kpiTicketPage.waitForTicketRender();
    await kpiTicketPage.waitForLifecycleTimeline();
    log('Lifecycle section visible');

    const extracted = await kpiTicketPage.getTicketLifecycleData(ticketId, kpiName);
    if (extracted.missingField || !extracted.openingTime || !extracted.closingTime) {
      data = { ...extracted, missingField: extracted.missingField || 'openingTime/closingTime' };
      throw new Error(`Opening/closing time not available (missing: ${data.missingField}) - duration not calculated.`);
    }

    // Re-verify after the render wait, so a late navigation can't slip a wrong ticket through.
    const stillOpened = await kpiTicketPage.getOpenedTicketId();
    if (stillOpened !== ticketId) {
      throw new TicketMismatchError(`Ticket mismatch detected after render.\nExpected: ${ticketId}\nOpened: ${stillOpened || '(none found)'}\nIndex: ${index}`);
    }

    const d = computeDuration(extracted.openingTime, extracted.closingTime);
    data = { ...extracted, durationMinutes: d.minutes, durationHours: d.hours };
    log(`Opening Time: ${data.openingTime}`);
    log(`Closing Time: ${data.closingTime}`);
    log(`Duration: ${Math.round(d.minutes * 100) / 100} minutes`);

    await writer.upsertTicketRow({
      kpiName, index, ticketId, status: 'PROCESSED',
      openingTime: data.openingTime, closingTime: data.closingTime,
      durationMinutes: d.minutes, reassignedOrEscalated: data.reassignedOrEscalated,
    });
    ticket.status = 'processed';
    log('Excel updated');
    log('Status: PROCESSED');
  } catch (err) {
    ticket.status = 'failed';
    data = { ticketId, kpiCategory: kpiName, openingTime: data.openingTime || '', closingTime: data.closingTime || '', ...(data.missingField ? { missingField: data.missingField } : {}), error: String(err.message).replace(/\n/g, ' | ') };
    log(`ERROR: ${err.message}`);
    log('Status: FAILED');
    // A mismatched page's times belong to a different ticket - never write them.
    const safeToShowTimes = !(err instanceof TicketMismatchError);
    await writer.upsertTicketRow({
      kpiName, index, ticketId, status: 'FAILED',
      openingTime: safeToShowTimes ? data.openingTime : '', closingTime: safeToShowTimes ? data.closingTime : '',
      details: data.error,
    });
  }
  return data;
}

/**
 * Runs both phases for one KPI and returns everything needed to calculate and
 * validate it. Also performs the final discovered == processed == Excel check.
 */
async function runKpiTwoPhase({ kpiDashboardPage, kpiTicketPage, kpiName, writer, log = console.log }) {
  const { dashboardValue, indexedTickets, duplicates } = await discoverAllKpiTickets({ kpiDashboardPage, kpiTicketPage, kpiName, writer, log });

  const tickets = [];
  for (const ticket of indexedTickets) {
    if (ticket.status !== 'pending') continue; // a processed/failed index is never revisited
    tickets.push(await processIndexedTicket({ kpiDashboardPage, kpiTicketPage, kpiName, ticket, total: indexedTickets.length, writer, log }));
  }

  const discovered = indexedTickets.length;
  const processed = indexedTickets.filter((t) => t.status === 'processed').length;
  const excelRecords = await writer.countProcessedTicketRows(kpiName);
  log(`\n[${kpiName}] Discovered: ${discovered} | Processed: ${processed} | Excel Records: ${excelRecords}`);

  return { dashboardValue, indexedTickets, duplicates, tickets, validation: { discovered, processed, excelRecords } };
}

module.exports = { createIndexedTicketList, discoverAllKpiTickets, processIndexedTicket, runKpiTwoPhase, TicketMismatchError };
