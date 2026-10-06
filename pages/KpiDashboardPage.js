// @ts-check
const { expect } = require('@playwright/test');
const { pause } = require('../utils/auth');

/**
 * The four KPI cards on the Admin Dashboard. `cardNamePattern` is
 * intentionally a loose, case-insensitive regex (not an exact string) so
 * small copy differences in the real app ("IT Staff MTTR" vs "IT Staff
 * Mean Time To Resolve") still match - accessible role/text selectors per
 * the project's selector conventions, not fragile nth-child/class selectors.
 *
 * NOTE: these patterns, plus the drill-in navigation in clickKpi() below,
 * are this feature's best-effort first pass absent direct access to the
 * live dashboard markup. If a card isn't found, widen its pattern here (one
 * place) rather than in the spec file.
 */
const KPI_CARDS = {
  'IT Staff MTTR': /it\s*staff\s*mttr|it\s*staff.*mean time to resolve/i,
  'AI MTTR': /\bai\s*mttr\b|ai.*mean time to resolve/i,
  'IT Staff First Contact Resolution': /it\s*staff.*first contact resolution|\bfcr\b/i,
  'IT Staff On Leave Today': /it\s*staff.*on leave today|on leave today/i,
};

class KpiDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.navDashboard = page.getByRole('link', { name: /dashboard/i }).or(page.getByRole('button', { name: /dashboard/i }));
  }

  /**
   * @param {keyof typeof KPI_CARDS} kpiName
   * @returns {import('@playwright/test').Locator} the KPI card container
   */
  _cardLocator(kpiName) {
    const pattern = KPI_CARDS[kpiName];
    if (!pattern) throw new Error(`KpiDashboardPage: unknown KPI name "${kpiName}". Known: ${Object.keys(KPI_CARDS).join(', ')}`);
    // The card's accessible name/text is the KPI title; the value is a sibling
    // element within the same card container. We locate the heading/text node
    // first, then walk up to a reasonably-sized ancestor container to read
    // the value and to click the card as a whole.
    return this.page
      .locator('[class*="card" i], [data-testid*="kpi" i], article, section')
      .filter({ hasText: pattern })
      .first();
  }

  /**
   * Read the KPI value currently displayed on the Admin Dashboard card,
   * BEFORE clicking into it. e.g. "3.7 hr", "92%", "2".
   * @param {keyof typeof KPI_CARDS} kpiName
   * @returns {Promise<string>}
   */
  async getKpiValue(kpiName) {
    const card = this._cardLocator(kpiName);
    await expect(card, `KPI card "${kpiName}" was not found on the Admin Dashboard`).toBeVisible({ timeout: 15000 });
    const text = (await card.innerText()).trim();
    // The card's text typically looks like "IT Staff MTTR\n3.7 hr" - strip the
    // title line(s) matching the pattern and any trailing label words, leaving
    // just the value. Kept deliberately permissive since we don't know the
    // exact markup; callers should treat this as a display string for
    // reporting/comparison, not a guaranteed-clean number.
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const valueLine = lines.find((l) => !KPI_CARDS[kpiName].test(l)) || lines[lines.length - 1] || text;
    return valueLine;
  }

  /**
   * Click a KPI card to drill into its ticket/staff list.
   * @param {keyof typeof KPI_CARDS} kpiName
   */
  async clickKpi(kpiName) {
    const card = this._cardLocator(kpiName);
    await expect(card, `KPI card "${kpiName}" was not found on the Admin Dashboard`).toBeVisible({ timeout: 15000 });
    await card.click();
    await pause(this.page);
  }

  /** Explicitly navigate back to the Admin Dashboard (never page.goBack()). */
  async returnToAdminDashboard() {
    await this.navDashboard.first().click();
    await this.waitForDashboard();
  }

  /** Wait until the Admin Dashboard (and its KPI cards) are fully loaded.
   * Optionally switches the period filter to a past month so KPI cards show
   * real data (the default period may be the current month with 0 resolved
   * tickets). Set env var KPI_PERIOD_MONTH and KPI_PERIOD_YEAR to override.
   * @param {{ selectDataPeriod?: boolean }} [options]
   */
  async waitForDashboard({ selectDataPeriod = true } = {}) {
    await expect(
      this.page.getByRole('heading', { name: /dashboard/i }).or(this.page.getByText(/system administration/i).first())
    ).toBeVisible({ timeout: 15000 });
    // Wait for at least one KPI card to render before returning, since the
    // caller is very likely about to click one immediately.
    await expect(this.page.locator('[class*="card" i], [data-testid*="kpi" i], article, section').first()).toBeVisible({
      timeout: 15000,
    });
    await pause(this.page);

    if (selectDataPeriod) {
      await this._selectBestPeriod();
    }
  }

  /**
   * Translates any month representation ("September", "Sep", "9", 9) into
   * the exact label ("Sep") and option value ("9") used by the dashboard dropdown.
   * @param {string|number} monthInput
   * @returns {{ label: string, value: string }}
   */
  _resolveMonth(monthInput) {
    if (!monthInput) return { label: 'Sep', value: '9' };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const s = String(monthInput).trim().toLowerCase();
    const num = parseInt(s, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      return { label: MONTHS[num - 1], value: String(num) };
    }
    const idx = MONTHS.findIndex((m) => m.toLowerCase() === s.slice(0, 3));
    if (idx !== -1) {
      return { label: MONTHS[idx], value: String(idx + 1) };
    }
    return { label: String(monthInput), value: String(monthInput) };
  }

  /**
   * Sets the dashboard period filter (Period type: Month + Year, Month: Sep, Year: 2026).
   * @param {string|number} [month] - e.g. "Sep" or "September" (default: "Sep")
   * @param {string|number} [year]  - e.g. "2026" (default: "2026")
   * @returns {Promise<boolean>}
   */
  async setDashboardPeriod(month = 'Sep', year = '2026') {
    return await this._trySetPeriod(month, year);
  }

  /**
   * Tries to set the dashboard period to a month/year that shows non-zero KPI data.
   * Defaults to Sep 2026 where valid KPI ticket data is present.
   */
  async _selectBestPeriod() {
    const targetMonth = process.env.KPI_PERIOD_MONTH || 'Sep';
    const targetYear  = process.env.KPI_PERIOD_YEAR || '2026';

    // First attempt: try configured / preferred period (Sep 2026)
    const success = await this._trySetPeriod(targetMonth, targetYear);
    if (success) {
      const mttrVal = await this.getKpiValue('IT Staff MTTR').catch(() => '');
      if (/[1-9]/.test(mttrVal)) {
        console.log(`[KpiDashboardPage] ✅ Active period: ${targetMonth} ${targetYear} (IT Staff MTTR: ${mttrVal})`);
        return;
      }
    }

    // Fallback: walk back month by month (up to 12)
    const now = new Date();
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    for (let offset = 1; offset <= 12; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const mName = MONTHS[d.getMonth()];
      const yStr  = String(d.getFullYear());
      console.log(`[KpiDashboardPage] Trying period: ${mName} ${yStr}`);
      const changed = await this._trySetPeriod(mName, yStr);
      if (!changed) continue;

      const mttrVal = await this.getKpiValue('IT Staff MTTR').catch(() => '');
      if (/[1-9]/.test(mttrVal)) {
        console.log(`[KpiDashboardPage] ✅ Found data for period: ${mName} ${yStr} (IT Staff MTTR: ${mttrVal})`);
        return;
      }
    }
    console.log('[KpiDashboardPage] ⚠ No non-zero KPI period found — using current period.');
  }

  /**
   * Sets the period type to "Month + Year", selects the month and year dropdowns,
   * and clicks Refresh. Returns true if successful.
   * @param {string|number} monthInput - e.g. "Sep" or "September"
   * @param {string|number} yearInput  - e.g. "2026"
   */
  async _trySetPeriod(monthInput, yearInput) {
    try {
      // 1. Ensure Period dropdown is "Month + Year" (value="month")
      const periodSel = this.page.locator('#analytics-period, select[aria-label="Global dashboard period"], select[name="period"]').first();
      if (await periodSel.isVisible().catch(() => false)) {
        const curVal = await periodSel.inputValue().catch(() => '');
        if (curVal !== 'month') {
          await periodSel.selectOption('month').catch(() =>
            periodSel.selectOption({ label: 'Month + Year' }).catch(() => {})
          );
          await this.page.waitForTimeout(500);
        }
      }

      // 2. Month dropdown (aria-label="Analytics month", values: "1"-"12", labels: "Jan"-"Dec")
      const monthSel = this.page.locator('select[aria-label="Analytics month"], select[aria-label*="month" i]').first()
        .or(this.page.locator('select').filter({ hasText: /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i }).first());

      if (!(await monthSel.isVisible().catch(() => false))) return false;

      const { label, value } = this._resolveMonth(monthInput);
      await monthSel.selectOption(value).catch(() =>
        monthSel.selectOption({ label }).catch(() => {})
      );

      // 3. Year dropdown (aria-label="Analytics year")
      const yearSel = this.page.locator('select[aria-label="Analytics year"], select[aria-label*="year" i]').first()
        .or(this.page.locator('select').filter({ hasText: /202[0-9]/i }).first());

      if (await yearSel.isVisible().catch(() => false)) {
        const y = String(yearInput);
        await yearSel.selectOption(y).catch(() =>
          yearSel.selectOption({ label: y }).catch(() => {})
        );
      }

      // 4. Click Refresh button to apply the selected period
      const refreshBtn = this.page.getByRole('button', { name: /refresh/i }).first();
      if (await refreshBtn.isVisible().catch(() => false)) {
        await refreshBtn.click();
        await this.page.waitForTimeout(1500);
      } else {
        await this.page.waitForTimeout(1000);
      }

      return true;
    } catch (rawErr) {
      const err = /** @type {any} */ (rawErr);
      console.warn(`[KpiDashboardPage] Failed to set period: ${err && err.message}`);
      return false;
    }
  }
}

module.exports = { KpiDashboardPage, KPI_CARDS };
