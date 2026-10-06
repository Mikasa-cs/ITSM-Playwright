import { test, expect } from '../../fixtures/roles.fixture';
import { BasePage } from '../../pages/common/BasePage';

test.describe('Knowledge Base (Admin)', () => {
  test('[KB -01] Verify Knowledge Base page loads successfully', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Login as Admin.', async () => {
    // Handled by the '{project}' storageState fixture: Login as Admin.
    });
    await test.step('Click Knowledge Base from the sidebar.', async () => {
    await base.click('Knowledge Base from the sidebar');
    await base.expectVisible('Knowledge Base page opens successfully and existing documents');
    });
  });

  test('[KB -02] Verify existing documents are displayed', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Knowledge Base.', async () => {
    // TODO: Open Knowledge Base.
    });
    await test.step('Inspect document list.', async () => {
    // TODO: Inspect document list.
    await base.expectVisible('Uploaded documents');
    });
  });

  test('[KB -03] Verify document search', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Knowledge Base.', async () => {
    // TODO: Open Knowledge Base.
    });
    await test.step('Enter an existing document name/keyword in Search documents.', async () => {
    await base.fillByLabel('Search documents', 'an existing document name/keyword');
    await base.expectVisible('Matching document(s)');
    });
  });

  test('[KB -04] Verify search with no matching document', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Search for a non-existing document name.', async () => {
    // TODO: Search for a non-existing document name.
    await base.expectVisible('No matching document');
    });
  });

  test('[KB -05] Verify Upload Document modal opens', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click Upload Document.', async () => {
    await base.click('Upload Document');
    // Expected: Upload Document modal opens and displays file selection, Title, Category, Tags, Cancel and Upload controls.
    });
  });

  test('[KB -06] Verify supported file types', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Upload Document.', async () => {
    // TODO: Open Upload Document.
    });
    await test.step('Select a supported PDF/DOCX/TXT/Markdown file.', async () => {
    await base.click('a supported PDF/DOCX/TXT/Markdown file'); // select option
    // Expected: Supported file is accepted for upload.
    });
  });

  test('[KB -07] Verify unsupported file type is rejected', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Upload Document.', async () => {
    // TODO: Open Upload Document.
    });
    await test.step('Attempt to select an unsupported file type.', async () => {
    // TODO: Attempt to select an unsupported file type.
    await base.expectVisible('Unsupported file is rejected and an appropriate validation message');
    });
  });

  test('[KB -08] Upload a knowledge-base document', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click Upload Document.', async () => {
    await base.click('Upload Document');
    });
    await test.step('Select a valid document.', async () => {
    await base.click('a valid document'); // select option
    });
    await test.step('Enter title/category/tags if required.', async () => {
    // TODO: enter value -> Enter title/category/tags if required.
    // await base.fillByLabel('<label>', '<value>');
    });
    await test.step('Click Upload.', async () => {
    await base.click('Upload');
    // Expected: Document uploads successfully and appears in the document list.
    });
  });

  test('[KB -09] Verify uploaded document metadata', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Upload a document with Title, Category and Tags.', async () => {
    // TODO: Upload a document with Title, Category and Tags.
    });
    await test.step('Return to document list.', async () => {
    // TODO: Return to document list.
    // Expected: Uploaded document appears with correct title/file information and metadata as supported by the UI.
    });
  });

  test('[KB -10] Verify mandatory/invalid upload validation', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Upload Document.', async () => {
    // TODO: Open Upload Document.
    });
    await test.step('Attempt upload without selecting a file.', async () => {
    // TODO: Attempt upload without selecting a file.
    await base.expectVisible('Upload is prevented and appropriate validation');
    });
  });

  test('[KB -11] Verify Cancel/Discard upload', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Open Upload Document.', async () => {
    // TODO: Open Upload Document.
    });
    await test.step('Enter data/select a file.', async () => {
    // TODO: enter value -> Enter data/select a file.
    // await base.fillByLabel('<label>', '<value>');
    });
    await test.step('Click Discard / Cancel.', async () => {
    await base.click('Discard / Cancel');
    // Expected: Modal closes and the document is not uploaded.
    });
  });

  test('[KB -12] Verify delete document', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Select an existing document.', async () => {
    await base.click('an existing document'); // select option
    });
    await test.step('Click delete icon.', async () => {
    await base.click('delete icon');
    });
    await test.step('Confirm deletion.', async () => {
    // TODO: Confirm deletion.
    // Expected: Document is deleted successfully and removed from the Knowledge Base list.
    });
  });

  test('[KB -13] Verify cancel document deletion', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Click delete on an existing document.', async () => {
    await base.click('delete on an existing document');
    });
    await test.step('Cancel the confirmation.', async () => {
    // TODO: Cancel the confirmation.
    // Expected: Document remains in the Knowledge Base.
    });
  });

  test('[KB -14] Verify deleted document cannot be found by search', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Delete a document.', async () => {
    // TODO: Delete a document.
    });
    await test.step('Search for its filename/title.', async () => {
    // TODO: Search for its filename/title.
    // Expected: Deleted document is no longer returned in search results.
    });
  });

  test('[KB -15] Verify uploaded document persists after refresh', async ({ page }) => {
    const base = new BasePage(page);
    await test.step('Upload a valid document.', async () => {
    // TODO: Upload a valid document.
    });
    await test.step('Refresh the page.', async () => {
    // TODO: Refresh the page.
    // Expected: Uploaded document remains available after page refresh.
    });
  });

});
