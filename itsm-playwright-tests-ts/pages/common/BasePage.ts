import { Page, Locator, expect } from '@playwright/test';

/**
 * Shared helpers used by every page object.
 * These resolve elements by their visible text/role, which is how most of
 * the ITSM_2_0 test cases describe UI elements (e.g. "Click Escalate",
 * "Reassign Ticket modal"). Swap a helper for a more specific locator in a
 * page object subclass if the semantic lookup is ambiguous on a given page.
 */
export class BasePage {
  constructor(public readonly page: Page) {}

  /** Click a button/link by its visible accessible name. */
  async click(name: string) {
    const target = this.page.getByRole('button', { name, exact: false })
      .or(this.page.getByRole('link', { name, exact: false }))
      .or(this.page.getByText(name, { exact: false }));
    await target.first().click();
  }

  /** Click a sidebar/nav item by visible text. */
  async clickNav(name: string) {
    await this.page.getByRole('link', { name, exact: false }).first().click();
  }

  /** Fill a labelled input/textarea by its label text. */
  async fillByLabel(label: string, value: string) {
    await this.page.getByLabel(label, { exact: false }).fill(value);
  }

  /** Select a dropdown option by its visible option text. */
  async selectOption(label: string, optionText: string) {
    const select = this.page.getByLabel(label, { exact: false });
    await select.selectOption({ label: optionText });
  }

  /** Check a checkbox by its label text. */
  async check(label: string) {
    await this.page.getByLabel(label, { exact: false }).check();
  }

  /** Assert that text is visible somewhere on the page. */
  async expectVisible(text: string) {
    await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible();
  }

  /** Assert that text is NOT visible on the page. */
  async expectNotVisible(text: string) {
    await expect(this.page.getByText(text, { exact: false })).toHaveCount(0);
  }

  /** Assert a button with this name is visible (and optionally enabled). */
  async expectButtonVisible(name: string, enabled = true) {
    const btn = this.page.getByRole('button', { name, exact: false }).first();
    await expect(btn).toBeVisible();
    if (enabled) await expect(btn).toBeEnabled();
  }

  async expectUrlContains(fragment: string) {
    await expect(this.page).toHaveURL(new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  async reload() {
    await this.page.reload();
  }

  locatorByText(text: string): Locator {
    return this.page.getByText(text, { exact: false });
  }
}
