// @ts-check
// ---------------------------------------------------------------------------
// Reliable date/time parsing + duration calculation for KPI validation.
// Centralized here (no such utility existed in the project yet) so every KPI
// calculation goes through the same, tested logic rather than re-deriving
// durations from ad-hoc string math.
// ---------------------------------------------------------------------------

/**
 * Parse a timestamp string as displayed by the application into a Date.
 * Handles the common formats ITSM UIs render lifecycle timestamps in:
 *   - ISO 8601: "2026-09-20T14:32:00Z" / "2026-09-20T14:32:00.000Z"
 *   - "MM/DD/YYYY, hh:mm:ss AM/PM"  (Node/Intl toLocaleString default)
 *   - "MM/DD/YYYY hh:mm AM/PM"
 *   - "Sep 20, 2026, 2:32 PM"
 * Falls back to `new Date(raw)` (native parsing) for any other format, and
 * throws a descriptive error if nothing works - callers must NOT silently
 * swallow an unparsable timestamp (see kpi-validation.spec.js's failure
 * handling requirements).
 *
 * @param {string} raw - the exact text as displayed by the application
 * @returns {Date}
 */
function parseDisplayedTimestamp(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error(`parseDisplayedTimestamp: empty or non-string value: ${JSON.stringify(raw)}`);
  }
  const trimmed = raw.trim();

  // ISO 8601 - most reliable, try first.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // "MM/DD/YYYY, hh:mm:ss AM/PM" or "MM/DD/YYYY hh:mm AM/PM" (comma optional, seconds optional)
  const usFormat = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );
  if (usFormat) {
    const [, mm, dd, yyyy, hh, min, sec, ampm] = usFormat;
    let hour = parseInt(hh, 10);
    if (ampm) {
      const isPM = /pm/i.test(ampm);
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
    }
    const d = new Date(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      hour,
      parseInt(min, 10),
      sec ? parseInt(sec, 10) : 0
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Last resort: native Date parsing handles "Sep 20, 2026, 2:32 PM" and
  // most other common English-locale formats directly.
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) return native;

  throw new Error(`parseDisplayedTimestamp: could not parse timestamp "${raw}" with any known format.`);
}

/**
 * Compute the duration between two displayed timestamps.
 * @param {string} openingRaw
 * @param {string} closingRaw
 * @returns {{ ms: number, minutes: number, hours: number, openingDate: Date, closingDate: Date }}
 */
function computeDuration(openingRaw, closingRaw) {
  const openingDate = parseDisplayedTimestamp(openingRaw);
  const closingDate = parseDisplayedTimestamp(closingRaw);
  const ms = closingDate.getTime() - openingDate.getTime();
  if (ms < 0) {
    throw new Error(
      `computeDuration: closing time (${closingRaw}) is before opening time (${openingRaw}) - check parsing/timestamps.`
    );
  }
  return {
    ms,
    minutes: ms / 60000,
    hours: ms / 3600000,
    openingDate,
    closingDate,
  };
}

/** Round to a fixed number of decimals without floating point noise (e.g. roundTo(3.14159, 2) -> 3.14). */
function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

module.exports = { parseDisplayedTimestamp, computeDuration, roundTo };
