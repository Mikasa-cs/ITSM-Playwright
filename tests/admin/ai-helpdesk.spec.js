// @ts-check
const { test, expect } = require('../../fixtures/admin.fixture');
const { loadAiHelpdeskCases, allowsDecline } = require('../../utils/ai-helpdesk-excel-cases');

// One test per row of the "AI Helpdesk Test Cases" sheet where
// Dashboard === 'Admin', generated in the exact order those rows appear in
// Excel (see global-setup.js). Nothing here is hardcoded per scenario - the
// query sent to the chatbot and whether a resolution is required both come
// from the workbook, so adding/reordering/editing rows in Excel changes what
// runs without touching this file.
const cases = loadAiHelpdeskCases('Admin');

test.describe('Admin - AI Helpdesk Copilot (Excel-driven)', () => {
  for (const row of cases) {
    const requiresResolution = !allowsDecline(row.expectedBehavior);

    test(`${row.testId}: ${row.description}`, async ({ adminPage, adminDashboardPage, aiHelpdeskPage }, testInfo) => {
      test.setTimeout(120_000);

      await adminDashboardPage.goToAIHelpdesk();

      const result = await aiHelpdeskPage.conductAutonomousChat({
        problem: row.query,
        initialPrompt: row.query,
        maxTurns: 6,
        observeMs: 2000,
        conversationTimeoutMs: 90_000, // hard 90s wall-clock per test case
        });

      // Record what actually happened - dynamically, from the real
      // conversation outcome - into the Excel row via the excel-sync-reporter
      // (reporter/test-id-map.js maps this file's tests to the AIHD-ADM-*
      // rows by Test ID prefix; the reporter picks this annotation up as the
      // "Actual Result" cell text instead of a generic message).
      const summary = result.declined
        ? `Chatbot explicitly declined to resolve this query after ${result.turnsCompleted} turn(s) - treated as a legitimate response. Reply: "${result.declineReason}"`
        : result.isSatisfied
        ? `Chatbot reached a satisfactory resolution after ${result.turnsCompleted} turn(s).`
        : `Chatbot neither resolved nor explicitly declined the query after ${result.turnsCompleted} turn(s) (ambiguous outcome).`;
      testInfo.annotations.push({ type: 'excel-actual-result', description: summary });
      if (result.usedFallback) {
        testInfo.annotations.push({
          type: 'warning',
          description: 'One or more turns were evaluated by the built-in heuristic fallback (OpenAI quota/API unavailable), not a live LLM judgment.',
        });
      }

      if (requiresResolution) {
        // This row's Excel "Expected Resolution Behavior" requires an actual
        // resolution - an explicit decline does NOT satisfy it, and fails
        // the test exactly like before.
        expect(result.isSatisfied, `AI Helpdesk was expected to resolve: "${row.query}"`).toBeTruthy();
      } else {
        // This row explicitly allows the chatbot to decline. Do not force a
        // resolution, and do not fail merely because it declined - only fail
        // if it neither resolved the issue nor gave a legitimate decline.
        expect(
          result.isSatisfied || result.declined,
          `AI Helpdesk should either resolve the issue or legitimately decline it for: "${row.query}"`
        ).toBeTruthy();
      }
    });
  }

  if (cases.length === 0) {
    test('no AI Helpdesk test cases found for Admin in ITSM_2_0_Test_Cases.xlsx', async () => {
      test.fixme(true, 'Add rows with Dashboard = "Admin" to the "AI Helpdesk Test Cases" sheet.');
    });
  }
});
