// @ts-check
const { roundTo } = require('./date-time');

// ---------------------------------------------------------------------------
// KPI calculation logic, kept deliberately separate from UI navigation
// (kpi-validation.spec.js does the navigating/collecting; this file only
// turns collected data into a KPI number), per the project's "keep
// calculation logic separate from UI navigation logic" requirement.
//
// IMPORTANT - formula provenance:
// No existing KPI/SLA formula document or code was found anywhere in this
// project (searched for "MTTR", "SLA", "First Contact Resolution", etc. -
// see EXCEL_SYNC.md / kpi-validation.spec.js header comment for what was
// checked). The four functions below use the standard, widely-used ITSM
// definitions for each metric. If your organization's actual formula
// differs (e.g. a different FCR definition, business-hours-only MTTR,
// excluding certain ticket statuses, etc.), update the corresponding
// function here - the navigation/collection code in kpi-validation.spec.js
// does not need to change.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} KpiTicketData
 * @property {string} ticketId
 * @property {string} kpiCategory
 * @property {string} openingTime          - raw, as displayed
 * @property {string} closingTime          - raw, as displayed
 * @property {number} [durationMinutes]
 * @property {number} [durationHours]
 * @property {boolean} [reassignedOrEscalated] - true if the lifecycle timeline shows a reassignment/escalation event
 * @property {boolean} [resolvedByAi]          - true if the lifecycle timeline shows the ticket was resolved by the AI Helpdesk/Copilot rather than a human agent
 * @property {string} [missingField]           - set when opening/closing time could not be read (see failure handling)
 * @property {string} [error]                  - set when the ticket could not be opened/processed at all
 * @property {Record<string, unknown>} [additionalData]
 */

/**
 * @typedef {Object} KpiCalculationResult
 * @property {string} kpiName
 * @property {number|null} value            - null when the KPI could not be calculated (e.g. zero valid tickets)
 * @property {string} unit                  - e.g. 'hours', '%', 'count'
 * @property {number} ticketCount           - tickets that contributed to the calculation
 * @property {number} incompleteCount       - tickets that could NOT contribute (missing fields / errors)
 * @property {string[]} incompleteReasons    - one entry per incomplete ticket, for reporting
 */

/** Mean Time To Resolve for IT Staff-handled tickets (the "IT Staff MTTR" KPI card's own ticket list). */
function calculateItStaffMttr(tickets) {
  return calculateMttrFor(tickets, 'IT Staff MTTR');
}

/** Mean Time To Resolve for AI Helpdesk-resolved tickets (the "AI MTTR" KPI card's own ticket list). */
function calculateAiMttr(tickets) {
  return calculateMttrFor(tickets, 'AI MTTR');
}

// Both MTTR variants use the same duration-averaging math; what differs is
// WHICH tickets get passed in, since each KPI card's list is presumed to
// already be scoped to that category by the application itself (clicking
// "AI MTTR" shows AI-resolved tickets; clicking "IT Staff MTTR" shows
// IT-Staff-handled ones). We deliberately do NOT re-filter by the
// `resolvedByAi` text-detection flag here - that flag is a best-effort
// signal scraped from free-text timeline entries and re-filtering on it
// would risk *dropping* legitimately-scoped tickets whose timeline just
// doesn't happen to contain one of the matched phrases. If the two KPI
// cards' ticket lists turn out NOT to be pre-scoped this way in the real
// app, change the `includeFilter` argument back on a per-call basis here.
function calculateMttrFor(tickets, kpiName) {
  const incompleteReasons = [];
  const durations = [];

  for (const t of tickets) {
    if (t.error) {
      incompleteReasons.push(`${t.ticketId}: could not be opened/processed (${t.error})`);
      continue;
    }
    if (t.missingField) {
      incompleteReasons.push(`${t.ticketId}: missing ${t.missingField}`);
      continue;
    }
    if (typeof t.durationHours !== 'number' || isNaN(t.durationHours)) {
      incompleteReasons.push(`${t.ticketId}: duration could not be computed`);
      continue;
    }
    durations.push(t.durationHours);
  }

  const value = durations.length ? roundTo(durations.reduce((a, b) => a + b, 0) / durations.length, 2) : null;
  return {
    kpiName,
    value,
    unit: 'hours',
    ticketCount: durations.length,
    incompleteCount: incompleteReasons.length,
    incompleteReasons,
  };
}

/**
 * First Contact Resolution rate for IT Staff: percentage of tickets (from
 * the "IT Staff First Contact Resolution" KPI card's own ticket list)
 * resolved without a reassignment/escalation event visible in the
 * Lifecycle Timeline.
 */
function calculateItStaffFcr(tickets) {
  const incompleteReasons = [];
  let eligible = 0;
  let firstContactResolved = 0;

  for (const t of tickets) {
    if (t.error) {
      incompleteReasons.push(`${t.ticketId}: could not be opened/processed (${t.error})`);
      continue;
    }
    if (t.missingField) {
      incompleteReasons.push(`${t.ticketId}: missing ${t.missingField}`);
      continue;
    }
    eligible++;
    if (!t.reassignedOrEscalated) firstContactResolved++;
  }

  const value = eligible ? roundTo((firstContactResolved / eligible) * 100, 2) : null;
  return {
    kpiName: 'IT Staff First Contact Resolution',
    value,
    unit: '%',
    ticketCount: eligible,
    incompleteCount: incompleteReasons.length,
    incompleteReasons,
  };
}

/**
 * "IT Staff On Leave Today" is a headcount, not a ticket-duration metric -
 * it's simply how many IT Staff members have an active leave record for
 * today's date. `entries` here is the list collected from whatever
 * list/page the KPI card opens (staff names/leave records), not tickets.
 * @param {Array<{staffName: string, error?: string}>} entries
 */
function calculateItStaffOnLeave(entries) {
  const incompleteReasons = entries.filter((e) => e.error).map((e) => `${e.staffName || 'unknown'}: ${e.error}`);
  const validEntries = entries.filter((e) => !e.error);
  return {
    kpiName: 'IT Staff On Leave Today',
    value: validEntries.length,
    unit: 'count',
    ticketCount: validEntries.length,
    incompleteCount: incompleteReasons.length,
    incompleteReasons,
  };
}

module.exports = {
  calculateItStaffMttr,
  calculateAiMttr,
  calculateItStaffFcr,
  calculateItStaffOnLeave,
};
