// @ts-check
const { expect } = require('@playwright/test');

/**
 * Matches the Copilot's own failure bubble, e.g.
 * "Sorry, there was an error processing your request. Please try again."
 * Kept broad enough to catch minor copy changes without missing the real alert.
 */
const COPILOT_ERROR_PATTERN = /sorry,?\s*there was an error processing your request/i;

/**
 * Check the chat thread for the Copilot's own error bubble and fail fast if present.
 * Call this right after any action that waits on an AI response, so the test
 * stops at the point of failure instead of timing out later on UI that will
 * never appear (suggestion buttons, resolution state, etc).
 * @param {import('@playwright/test').Page} page
 * @param {string} [context] - short label for where this check ran, e.g. the message sent
 */
async function assertNoCopilotError(page, context = '') {
  const errorBubble = page.getByText(COPILOT_ERROR_PATTERN).first();

  if (await errorBubble.isVisible().catch(() => false)) {
    const bubbleText = await errorBubble.innerText().catch(() => COPILOT_ERROR_PATTERN.source);
    throw new Error(
      `AI Copilot returned an error response${context ? ` after: "${context}"` : ''}. ` +
      `Bubble text: "${bubbleText.trim()}". Stopping test — backend/API likely failed.`
    );
  }
}

/**
 * Send one message in the AI Helpdesk chat and wait for a reply.
 * Automatically fails the test if the Copilot responds with its error bubble.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @param {{ delay?: number, waitAfterMs?: number }} [options]
 */
async function sendChatMessage(page, text, { delay = 60, waitAfterMs = 3500 } = {}) {
  const chatInput = page.locator('#ai-copilot-message')
    .or(page.getByPlaceholder(/ask it support|troubleshoot|type.*message/i))
    .or(page.locator('textarea'))
    .first();

  await expect(chatInput).toBeVisible({ timeout: 15000 });
  await chatInput.click();
  await chatInput.pressSequentially(text, { delay });

  const sendBtn = page.locator('button[type="submit"]')
    .or(page.getByRole('button', { name: /send/i }))
    .first();

  if (await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  // Allow the AI service time to process and respond
  await page.waitForTimeout(waitAfterMs);

  // Fail immediately if the Copilot came back with its own error message
  await assertNoCopilotError(page, text);
}

/**
 * Click an action suggestion button offered by the AI bot (e.g. "Try another step", "Resolved")
 * @param {import('@playwright/test').Page} page
 * @param {RegExp|string} buttonPattern
 * @param {number} [timeout]
 */
async function clickSuggestion(page, buttonPattern, timeout = 30000) {
  const button = page.getByRole('button', { name: buttonPattern })
    .or(page.getByText(buttonPattern))
    .first();

  await expect(button).toBeVisible({ timeout });
  await button.click();
  await page.waitForTimeout(2000);

  // Fail immediately if that click triggered a Copilot error
  await assertNoCopilotError(page, `clicked "${buttonPattern}"`);
}

module.exports = {
  sendChatMessage,
  clickSuggestion,
  assertNoCopilotError
};