import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class KnowledgeBasePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.clickNav('Knowledge Base');
  }

  async search(term: string) {
    await this.page.getByPlaceholder(/search documents/i).fill(term);
  }

  async openUploadModal() {
    await this.click('Upload Document');
  }

  async deleteDocumentByName(name: string) {
    const row = this.page.getByText(name, { exact: false }).locator('..');
    await row.getByRole('button', { name: /delete/i }).click();
  }
}
