// @ts-check
const { test, expect } = require('../../fixtures/itstaff.fixture');
const { loadAiHelpdeskCases, allowsDecline } = require('../../utils/ai-helpdesk-excel-cases');

// One test per row of the "AI Helpdesk Test Cases" sheet where
// Dashboard === 'IT Staff', generated in the exact order those rows appear
// in Excel (see global-setup.js). Nothing here is hardcoded per scenario -
// the query sent to the chatbot and whether a resolution is required both
// come from the workbook.
const cases = loadAiHelpdeskCases('IT Staff');

test.describe('IT Staff - AI Helpdesk Copilot (Excel-driven)', () => {
  for (const row of cases) {
    const requiresResolution = !allowsDecline(row.expectedBehavior);

    test(`${row.testId}: ${row.description}`, async ({ itStaffPage, itStaffDashboardPage, aiHelpdeskPage }, testInfo) => {
      test.setTimeout(120_000);

      await itStaffDashboardPage.goToAIHelpdesk();

      const result = await aiHelpdeskPage.conductAutonomousChat({
        problem: row.query,
        initialPrompt: row.query,
        maxTurns: 5,
        observeMs: 2000,
        conversationTimeoutMs: 90_000, // hard 90s wall-clock per test case

      });

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
        expect(result.isSatisfied, `AI Helpdesk was expected to resolve: "${row.query}"`).toBeTruthy();
      } else {
        expect(
          result.isSatisfied || result.declined,
          `AI Helpdesk should either resolve the issue or legitimately decline it for: "${row.query}"`
        ).toBeTruthy();
      }
    });
  }

  if (cases.length === 0) {
    test('no AI Helpdesk test cases found for IT Staff in ITSM_2_0_Test_Cases.xlsx', async () => {
      test.fixme(true, 'Add rows with Dashboard = "IT Staff" to the "AI Helpdesk Test Cases" sheet.');
    });
  }
});
