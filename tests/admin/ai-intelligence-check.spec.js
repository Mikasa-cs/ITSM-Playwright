/**
 * Example: judging AI Copilot reply QUALITY, not just presence of text.
 * Playwright itself cannot tell if a reply is "smart" — this test sends
 * the reply to an LLM judge (utils/llm-judge.js) and asserts on its verdict.
 *
 * Requires OPENAI_API_KEY set in .env.
 */
const { test } = require('../../fixtures/admin.fixture');
const { expect } = require('@playwright/test');
const { judgeReply } = require('../../utils/llm-judge');

test.describe('AI Copilot — reply intelligence checks', () => {
    test('Copilot gives a relevant answer for a VPN connection issue', async ({
        adminPage,
        aiHelpdeskPage,
    }) => {
        const question = 'I cannot connect to the office VPN, what should I do?';

        await aiHelpdeskPage.navigate();
        await aiHelpdeskPage.sendMessage(question);

        const reply = await aiHelpdeskPage.getLastReply();

        const verdict = await judgeReply({
            userQuestion: question,
            botReply: reply,
            criteria:
                'Must address VPN troubleshooting specifically (e.g. checking ' +
                'credentials, VPN client status, network connectivity, or ' +
                'escalating to IT) rather than a generic or unrelated response.',
        });

        expect(verdict.pass, `LLM judge reason: ${verdict.reason}`).toBeTruthy();
        expect(verdict.score).toBeGreaterThanOrEqual(6);
    });

    test('Copilot gives a relevant answer for a password lockout issue', async ({
        adminPage,
        aiHelpdeskPage,
    }) => {
        const question = "I'm locked out of Okta SSO, how do I regain access?";

        await aiHelpdeskPage.navigate();
        await aiHelpdeskPage.sendMessage(question);

        const reply = await aiHelpdeskPage.getLastReply();

        const verdict = await judgeReply({
            userQuestion: question,
            botReply: reply,
            criteria:
                'Must mention account unlock/reset steps or direct escalation to ' +
                'IT for an Okta/SSO lockout, not a generic greeting or unrelated topic.',
        });

        expect(verdict.pass, `LLM judge reason: ${verdict.reason}`).toBeTruthy();
        expect(verdict.score).toBeGreaterThanOrEqual(6);
    });
});
