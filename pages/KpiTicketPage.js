// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

// A ticket ID as this app displays it - adjust this single pattern if the
// real format differs (e.g. "INC-000123" vs "TCK-123" vs a bare number).
const TICKET_ID_PATTERN = /\b([A-Z]{2,5}-\d{3,})\b/;

class KpiTicketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Collect every ticket ID currently retrievable for the open KPI list,
   * handling pagination (a "Next"/page-number control) or infinite scroll
   * (scrolling until no new IDs appear). Does NOT open any ticket.
   * @returns {Promise<string[]>}
   */
  async getAllTicketIds() {
    const collected = new Set();
    const MAX_SCROLL_ATTEMPTS = 25;
    const MAX_PAGES = 25;

    const collectVisible = async () => {
      // Wide selector: covers table rows, list items, card divs, anchor links,
      // spans, and any element with a row/listitem role — handles varied markup.
      const rows = this.page.locator(
        '[data-testid*="ticket" i], ' +
        'tr, li, ' +
        '[class*="ticket-row" i], [class*="ticket-card" i], ' +
        '[class*="ticket-item" i], [class*="ticket-list" i] > *, ' +
        '[class*="list-item" i], [class*="row" i], ' +
        'a[href*="ticket" i], a[href*="inc" i], ' +
        '[role="row"], [role="listitem"]'
      );
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const text = (await rows.nth(i).innerText().catch(() => '')) || '';
        const match = text.match(TICKET_ID_PATTERN);
        if (match) collected.add(match[1]);
      }

      // Fallback: if still nothing found, scan all text on the page for ticket IDs.
      if (collected.size === 0) {
        const pageText = (await this.page.locator('body').innerText().catch(() => '')) || '';
        const allMatches = [...pageText.matchAll(new RegExp(TICKET_ID_PATTERN.source, 'g'))];
        for (const m of allMatches) {
          if (m[1]) collected.add(m[1]);
        }
      }
    };

    await collectVisible();

    // Pagination: a visible "Next" control that is not disabled.
    let page = 1;
    while (page < MAX_PAGES) {
      const nextBtn = this.page.getByRole('button', { name: /^next$/i }).or(this.page.getByRole('link', { name: /^next$/i }));
      const hasNext = (await nextBtn.count()) > 0 && (await nextBtn.first().isVisible().catch(() => false));
      if (!hasNext) break;
      const disabled = await nextBtn.first().isDisabled().catch(() => true);
      if (disabled) break;
      const before = collected.size;
      await nextBtn.first().click();
      await pause(this.page, 1000);
      await collectVisible();
      page++;
      if (collected.size === before) break; // no new tickets appeared
    }

    // Infinite scroll: scroll and re-collect until the set stops growing.
    let scrollAttempt = 0;
    let previousSize = collected.size;
    while (scrollAttempt < MAX_SCROLL_ATTEMPTS) {
      await this.page.mouse.wheel(0, 2000);
      await pause(this.page, 800);
      await collectVisible();
      if (collected.size === previousSize) break;
      previousSize = collected.size;
      scrollAttempt++;
    }

    return Array.from(collected);
  }

  /**
   * Phase 1 helper: wait until the KPI ticket list has rendered. Returns false
   * (instead of throwing) when no ticket ever appears, so an empty KPI can be
   * reported clearly by the caller.
   * @returns {Promise<boolean>}
   */
  async waitForTicketList({ timeout = 15000 } = {}) {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    try {
      // Try visible text node first; fall back to scanning body innerText so
      // dynamically-rendered lists (React/Vue) are also detected.
      await expect(this.page.getByText(TICKET_ID_PATTERN).first()).toBeVisible({ timeout });
      return true;
    } catch {
      // Body-text fallback: ticket IDs may be inside elements that Playwright
      // doesn't surface via getByText (e.g. inside <td> with complex children).
      const bodyText = (await this.page.locator('body').innerText().catch(() => '')) || '';
      return TICKET_ID_PATTERN.test(bodyText);
    }
  }

  /**
   * Phase 2: open the EXACT ticket by its ID (never by position). Matching is
   * boundary-aware so "INC-001" can never match "INC-0010". If the ticket isn't
   * on the first screen it pages ("Next") and scrolls until found; throws if
   * it genuinely isn't in the list.
   * @param {string} ticketId
   */
  async openTicketById(ticketId) {
    const exact = new RegExp(`(^|[^A-Za-z0-9-])${ticketId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9-])`);
    const target = () => this.page.getByText(exact).first();
    const MAX_PAGES = 25;
    const MAX_SCROLLS = 25;

    const tryClick = async () => {
      if ((await target().count()) > 0 && (await target().isVisible().catch(() => false))) {
        await target().scrollIntoViewIfNeeded().catch(() => {});
        await target().click();
        return true;
      }
      return false;
    };

    if (await tryClick()) return;

    for (let p = 1; p < MAX_PAGES; p++) {
      const next = this.page.getByRole('button', { name: /^next$/i }).or(this.page.getByRole('link', { name: /^next$/i }));
      if (!((await next.count()) > 0) || !(await next.first().isVisible().catch(() => false)) || (await next.first().isDisabled().catch(() => true))) break;
      await next.first().click();
      await pause(this.page, 1000);
      if (await tryClick()) return;
    }
    for (let i = 0; i < MAX_SCROLLS; i++) {
      await this.page.mouse.wheel(0, 2000);
      await pause(this.page, 800);
      if (await tryClick()) return;
    }
    throw new Error(`Ticket ${ticketId} was not found in the KPI ticket list.`);
  }

  /**
   * The ticket ID the detail page is actually showing (first ID found in the
   * page headings, else in the page body). Used to verify we opened the
   * ticket we meant to.
   * @returns {Promise<string>}
   */
  async getOpenedTicketId() {
    const headings = this.page.locator('h1, h2, h3, [data-testid*="ticket-id" i]');
    const n = await headings.count();
    for (let i = 0; i < n; i++) {
      const m = ((await headings.nth(i).innerText().catch(() => '')) || '').match(TICKET_ID_PATTERN);
      if (m) return m[1];
    }
    const body = (await this.page.locator('body').innerText().catch(() => '')) || '';
    const m = body.match(TICKET_ID_PATTERN);
    return m ? m[1] : '';
  }

  /**
   * Minimum render period after opening a ticket (the app needs 4-5 s before
   * its timeline is reliable), plus a real load-state wait. The fixed delay is
   * deliberate; proper visibility checks follow in waitForLifecycleTimeline().
   * Override with KPI_TICKET_RENDER_WAIT_MS (never below 4000).
   */
  async waitForTicketRender() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const ms = Math.max(4000, parseInt(process.env.KPI_TICKET_RENDER_WAIT_MS || '5000', 10));
    await this.page.waitForTimeout(ms);
  }

  /** Wait for the Lifecycle Timeline & Activity History heading, then scroll it into view. */
  async waitForLifecycleTimeline() {
    const heading = this.page.getByRole('heading', { name: /lifecycle timeline.*activity history|activity history/i });
    await expect(heading.first(), 'Lifecycle Timeline & Activity History section did not become visible').toBeVisible({ timeout: 20000 });
    await heading.first().scrollIntoViewIfNeeded();
  }

  /**
   * Scroll to the Lifecycle Timeline & Activity History section and extract
   * the data needed for KPI calculation. Returns a partial result with
   * `missingField` set (not thrown) when a field can't be found, per the
   * project's failure-handling requirement (record and continue, don't
   * silently skip).
   * @param {string} ticketId
   * @param {string} kpiCategory
   * @returns {Promise<import('../utils/kpi-calculator').KpiTicketData>}
   */
  async getTicketLifecycleData(ticketId, kpiCategory) {
    const timelineHeading = this.page.getByRole('heading', { name: /lifecycle timeline.*activity history|activity history/i });
    const timelineSection = timelineHeading
      .locator('xpath=ancestor::*[self::section or self::div][1]')
      .or(this.page.locator('[data-testid*="lifecycle" i], [data-testid*="activity-history" i]'));

    const sectionVisible = await timelineHeading.isVisible().catch(() => false);
    if (sectionVisible) {
      await timelineHeading.scrollIntoViewIfNeeded().catch(() => {});
      await pause(this.page, 500);
    }

    const scope = sectionVisible ? timelineSection.first() : this.page;

    // Look for explicit "Created"/"Opened" and "Resolved"/"Closed" timeline
    // entries. These text patterns are the best-effort guess absent access
    // to the live markup - widen them here if the app phrases events
    // differently (e.g. "Ticket raised", "Marked as resolved").
    const openingEntry = scope
      .locator('*')
      .filter({ hasText: /^(created|opened|raised|ticket created)\b/i })
      .first();
    const closingEntry = scope
      .locator('*')
      .filter({ hasText: /^(resolved|closed|ticket resolved|ticket closed)\b/i })
      .first();

    let openingTime = '';
    let closingTime = '';
    let missingField;

    const openingVisible = await openingEntry.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    const closingVisible = await closingEntry.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);

    try {
      if (openingVisible) openingTime = await this._extractTimestampNear(openingEntry);
      if (!openingTime) missingField = 'openingTime';
    } catch {
      missingField = 'openingTime';
    }

    try {
      if (closingVisible) closingTime = await this._extractTimestampNear(closingEntry);
      if (!closingTime) missingField = missingField ? `${missingField},closingTime` : 'closingTime';
    } catch {
      missingField = missingField ? `${missingField},closingTime` : 'closingTime';
    }

    const fullText = await scope.innerText().catch(() => '');
    const reassignedOrEscalated = /\b(reassigned|re-assigned|escalated)\b/i.test(fullText);
    const resolvedByAi = /\b(ai\s*(helpdesk|copilot)|resolved by ai|auto[-\s]?resolved)\b/i.test(fullText);

    return {
      ticketId,
      kpiCategory,
      openingTime,
      closingTime,
      reassignedOrEscalated,
      resolvedByAi,
      ...(missingField ? { missingField } : {}),
    };
  }

  /**
   * Given a locator pointing at a timeline entry's label text (e.g.
   * "Created"), find the timestamp displayed alongside it. Tries the
   * entry's own text first (label + timestamp often share one line/element),
   * then a following sibling.
   * @param {import('@playwright/test').Locator} entryLocator
   * @returns {Promise<string>}
   */
  async _extractTimestampNear(entryLocator) {
    const visible = await entryLocator.isVisible().catch(() => false);
    if (!visible) return '';
    const ownText = (await entryLocator.innerText().catch(() => '')) || '';
    const isoMatch = ownText.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/);
    if (isoMatch) return isoMatch[0];
    const usMatch = ownText.match(/\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/i);
    if (usMatch) return usMatch[0];
    const wordyMatch = ownText.match(/[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4},?\s+\d{1,2}:\d{2}\s*(AM|PM)?/);
    if (wordyMatch) return wordyMatch[0];

    // Timestamp not on the same line as the label - check the next sibling element.
    const sibling = entryLocator.locator('xpath=following-sibling::*[1]');
    const siblingText = (await sibling.innerText().catch(() => '')) || '';
    const siblingMatch =
      siblingText.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/) ||
      siblingText.match(/\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/i) ||
      siblingText.match(/[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4},?\s+\d{1,2}:\d{2}\s*(AM|PM)?/);
    return siblingMatch ? siblingMatch[0] : '';
  }

  /**
   * "IT Staff On Leave Today" opens a staff/leave list rather than tickets -
   * no per-item drill-in or resolution-time extraction is meaningful here,
   * just a count of who's listed. Returns one entry per row, with `error`
   * set if a row's staff name can't be read.
   * @returns {Promise<Array<{staffName: string, error?: string}>>}
   */
  async getStaffOnLeaveEntries() {
    const rows = this.page.locator('[data-testid*="leave" i], tr, li, [class*="leave-row" i], [class*="staff-row" i]');
    const count = await rows.count();
    const entries = [];
    for (let i = 0; i < count; i++) {
      const text = (await rows.nth(i).innerText().catch(() => '')) || '';
      const trimmed = text.trim();
      if (!trimmed) continue;
      const nameMatch = trimmed.split('\n')[0].trim();
      entries.push(nameMatch ? { staffName: nameMatch } : { staffName: '', error: 'could not read staff name from row' });
    }
    return entries;
  }
}

module.exports = { KpiTicketPage, TICKET_ID_PATTERN };
