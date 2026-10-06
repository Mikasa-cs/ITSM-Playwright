// @ts-check
const { expect } = require('@playwright/test');
const { sendChatMessage, clickSuggestion, assertNoCopilotError } = require('../utils/ai-evaluator');
const { pause } = require('../utils/auth');

class AIHelpdeskPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.navAIHelpdesk = page.getByRole('button', { name: /ai helpdesk/i })
      .or(page.getByRole('link', { name: /ai helpdesk/i }));
    this.chatContainer = page.locator('#ai-copilot-message')
      .or(page.getByPlaceholder(/ask it support|troubleshoot|type.*message/i))
      .or(page.locator('textarea'));
  }

  async navigate() {
    await this.navAIHelpdesk.first().click();
    await expect(this.chatContainer.first()).toBeVisible({ timeout: 15000 });
    await pause(this.page);
  }

  /**
   * Send a user query to the AI Copilot.
   * @param {string} message
   */
  async sendMessage(message) {
    await sendChatMessage(this.page, message);
  }

  /**
   * Click an interactive recommendation button provided by the Copilot.
   * @param {RegExp|string} buttonPattern
   */
  async selectOption(buttonPattern) {
    await clickSuggestion(this.page, buttonPattern);
  }

  /**
   * Scan the chat view for active action/suggestion buttons provided by the bot.
   * @returns {Promise<string[]>}
   */
  async getAvailableButtons() {
    return await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button:not([type="submit"])'));
      return buttons
        .map((b) => (b.textContent || '').trim())
        .filter((t) => {
          if (!t || t.length < 2) return false;
          if (/sign in|sign out|back|send|system admin|helpdesk copilot/i.test(t)) return false;
          return true;
        });
    });
  }

  /**
   * Get the text of the most recent Copilot (bot) reply.
   * Accurately filters out suggestion cards, input forms, and user outgoing bubbles.
   * @param {string} [previousReply]
   * @returns {Promise<string>}
   */
  async getLastReply(previousReply = '') {
    const reply = await this.page.evaluate((prev) => {
      const input = document.querySelector('#ai-copilot-message') || document.querySelector('textarea');
      const container = input?.closest('main') || document.querySelector('main') || document.body;

      // Find all text blocks inside the chat container
      const candidates = Array.from(container.querySelectorAll('div, p, span'))
        .filter((el) => {
          // Exclude inputs, buttons, and prompt chips
          if (el.closest('form') || el.closest('button') || el.closest('[class*="suggestion"]') || el.closest('[class*="quick-prompt"]')) {
            return false;
          }
          // Exclude user outgoing bubbles (typically styled with blue background or right-aligned)
          const cl = (el.className || '') + ' ' + (el.parentElement?.className || '');
          if (/justify-end|ml-auto|bg-blue|bg-primary|sent|user/i.test(cl)) {
            return false;
          }
          const text = (el.textContent || '').trim();
          // Exclude navigation / app headers / empty elements
          return text.length > 5 && !/type a message|ask it support|enterprise itsm|system administration/i.test(text);
        });

      // Walk backwards to find the newest bot response
      for (let i = candidates.length - 1; i >= 0; i--) {
        const text = (candidates[i].textContent || '').trim();
        if (text && text !== prev && !text.startsWith('Suggested:')) {
          return text;
        }
      }
      return candidates.length > 0 ? (candidates[candidates.length - 1].textContent || '').trim() : '';
    }, previousReply);

    if (reply) return reply;
    throw new Error('Could not isolate a bot reply in the chat view.');
  }

  /**
   * Wait for the AI Copilot to finish generating its response.
   * Returns immediately as soon as the text is stable (not still streaming).
   * Terminates early if:
   *  - The reply is identical to previousReply (bot is stuck/frozen)
   *  - A "loading" spinner is still present but has not changed in 15 s
   *  - Hard wall-clock timeout reached (default 30 s)
   *
   * @param {{ previousReply?: string, timeout?: number, observeMs?: number }} [options]
   * @returns {Promise<string>}
   */
  async waitForBotReply({ previousReply = '', timeout = 30000, observeMs = 2000 } = {}) {
    const startTime = Date.now();
    let lastText = '';
    let stableCount = 0;
    let unchangedCount = 0;

    // Short initial pause to let generation start
    await this.page.waitForTimeout(1500);

    while (Date.now() - startTime < timeout) {
      await assertNoCopilotError(this.page).catch((err) => { throw err; });

      let currentText = '';
      try { currentText = await this.getLastReply(previousReply); } catch { /* not yet */ }

      if (currentText && currentText.length > 5) {
        // ── If reply hasn't changed at all from previous reply for 5 polls → bot is frozen ──
        if (currentText === previousReply) {
          unchangedCount++;
          if (unchangedCount >= 5) {
            console.log('[AI Copilot] Reply unchanged from previous turn for 5 polls — bot appears stuck. Returning cached reply.');
            return previousReply || currentText;
          }
        } else {
          unchangedCount = 0;
        }

        // ── Stability check: same new text 3× in a row → streaming done ──
        if (currentText !== previousReply) {
          if (currentText === lastText) {
            stableCount++;
            if (stableCount >= 3) {
              console.log(`[AI Copilot] Response stabilized (${currentText.length} chars) in ${Math.round((Date.now()-startTime)/1000)}s.`);
              if (observeMs > 0) await this.page.waitForTimeout(observeMs);
              return currentText;
            }
          } else {
            stableCount = 0;
            lastText = currentText;
          }
        }
      }

      await this.page.waitForTimeout(500);
    }

    // Return whatever we have rather than throwing — avoids crashing the outer loop
    const best = lastText || previousReply;
    if (best) {
      console.log(`[AI Copilot] ⚠ Reply wait timed out after ${Math.round(timeout/1000)}s. Using best available text.`);
      return best;
    }
    throw new Error(`Timed out waiting for AI Copilot reply after ${Math.round(timeout/1000)}s — no text detected at all.`);
  }

  /**
   * Conduct an autonomous multi-turn conversation with the AI Helpdesk.
   *
   * TERMINATION RULES (in priority order):
   *   1. Bot explicitly declines → stop immediately (legitimate response)
   *   2. Bot reply is satisfied → stop immediately (issue resolved)
   *   3. Bot repeats the SAME reply twice in a row → treated as decline (stuck)
   *   4. maxTurns reached → stop (hard turn cap)
   *   5. conversationTimeoutMs reached → stop (hard wall-clock cap)
   *
   * The test is NEVER forced to run forever. If the AI can't answer,
   * we terminate cleanly and record "DECLINED" as the result.
   *
   * @param {Object} params
   * @param {string} params.problem                  - The core issue being solved
   * @param {string} [params.initialPrompt]          - First prompt to send
   * @param {number} [params.maxTurns]               - Max conversation turns (default 6)
   * @param {number} [params.observeMs]              - Pause per turn in headed mode
   * @param {number} [params.conversationTimeoutMs]  - Hard wall-clock cap for the whole conversation (default 3 min)
   */
  async conductAutonomousChat({ problem, initialPrompt, maxTurns = 6, observeMs = 2000, conversationTimeoutMs = 180_000 }) {
    const { analyzeAndGenerateReply, isExplicitDecline } = require('../utils/llm-agent');
    const conversationHistory = [];
    let currentMessage = initialPrompt || problem;
    /** @type {string|null} */
    let nextButtonToClick = null;
    let previousBotReply = '';
    let isSatisfied = false;
    let declined = false;
    let declineReason = '';
    let turn = 1;
    let anyFallbackUsed = false;
    const conversationStart = Date.now();

    console.log(`\n${'='.repeat(65)}`);
    console.log(`[Autonomous AI Agent] Problem: "${problem}"`);
    console.log(`Max turns: ${maxTurns} | Wall-clock timeout: ${conversationTimeoutMs/1000}s`);
    console.log(`${'='.repeat(65)}\n`);

    while (turn <= maxTurns && !isSatisfied && !declined) {

      // ── Hard wall-clock guard ──────────────────────────────────────────
      const elapsed = Date.now() - conversationStart;
      if (elapsed >= conversationTimeoutMs) {
        console.log(`[AI Agent] ⏱ Wall-clock timeout reached (${Math.round(elapsed/1000)}s). Terminating conversation.`);
        declined = true;
        declineReason = `Conversation exceeded the ${Math.round(conversationTimeoutMs/1000)}s wall-clock limit without resolution.`;
        break;
      }

      console.log(`\n>>> [Turn ${turn}/${maxTurns}] (${Math.round(elapsed/1000)}s elapsed)`);

      // ── 1. Send message or click button ───────────────────────────────
      if (nextButtonToClick) {
        console.log(`[Agent] Clicking: "${nextButtonToClick}"`);
        await this.selectOption(new RegExp(nextButtonToClick, 'i')).catch(() => {
          console.log(`[Agent] Button "${nextButtonToClick}" not found — sending text instead.`);
          nextButtonToClick = null;
        });
        if (nextButtonToClick) {
          conversationHistory.push({ user: `[Clicked: ${nextButtonToClick}]`, bot: '' });
          nextButtonToClick = null;
        } else {
          await this.sendMessage(currentMessage);
          conversationHistory.push({ user: currentMessage, bot: '' });
        }
      } else {
        console.log(`[Agent] Sending: "${currentMessage}"`);
        await this.sendMessage(currentMessage);
        conversationHistory.push({ user: currentMessage, bot: '' });
      }

      // ── 2. Wait for bot reply (30 s max, with stuck detection) ─────────
      const replyTimeout = Math.min(30_000, conversationTimeoutMs - (Date.now() - conversationStart) - 5000);
      if (replyTimeout <= 0) {
        console.log('[AI Agent] No time left for bot reply. Terminating.');
        declined = true;
        declineReason = 'No time remaining for bot reply within conversation timeout.';
        break;
      }

      const botReply = await this.waitForBotReply({
        previousReply: previousBotReply,
        timeout: replyTimeout,
        observeMs,
      });
      conversationHistory[conversationHistory.length - 1].bot = botReply;

      console.log(`<<< [Bot Reply]: "${botReply.slice(0, 200)}${botReply.length > 200 ? '…' : ''}"`);

      // ── 3. STALE REPLY DETECTION: same reply as last turn → bot is stuck ──
      if (botReply === previousBotReply && botReply.length > 0) {
        console.log('[AI Agent] 🔁 Bot returned identical reply to previous turn — treating as implicit decline (stuck).');
        declined = true;
        declineReason = `Bot returned the same reply twice in a row: "${botReply.slice(0, 180)}"…`;
        break;
      }

      // ── 4. Inline explicit-decline check (before calling LLM) ──────────
      if (isExplicitDecline(botReply.toLowerCase())) {
        console.log('[AI Agent] 🚫 Bot explicitly stated it cannot resolve this. Terminating immediately.');
        declined = true;
        declineReason = botReply.length > 220 ? `${botReply.slice(0, 220)}…` : botReply;
        break;
      }

      previousBotReply = botReply;

      // ── 5. Get available action buttons ───────────────────────────────
      const availableButtons = await this.getAvailableButtons();
      if (availableButtons.length > 0) console.log(`[Buttons]: ${JSON.stringify(availableButtons)}`);

      // ── 6. Analyze with LLM / heuristic ───────────────────────────────
      /** @type {import('../utils/llm-agent').AgentDecision} */
      const decision = await analyzeAndGenerateReply({
        problem,
        conversationHistory,
        latestBotReply: botReply,
        availableButtons,
      });

      if (decision.usedFallback) anyFallbackUsed = true;

      console.log(`[Eval T${turn}] ${decision.isSatisfied ? '✅ SATISFIED' : decision.declined ? '🚫 DECLINED' : '🔄 CONTINUING'} (score ${decision.satisfactionScore}/10) — ${decision.reason}`);

      // ── 7. Apply decision ──────────────────────────────────────────────
      if (decision.declined) {
        declined = true;
        declineReason = botReply.length > 220 ? `${botReply.slice(0, 220)}…` : botReply;
        console.log(`[AI Agent] 🚫 Legitimate decline after turn ${turn}. Not pushing for a forced resolution.`);
        break;
      }

      if (decision.isSatisfied) {
        isSatisfied = true;
        if (decision.actionButtonToClick) {
          console.log(`[Agent] Clicking resolution button: "${decision.actionButtonToClick}"`);
          await this.selectOption(new RegExp(decision.actionButtonToClick, 'i')).catch(() => {});
        }
        console.log(`[AI Agent] ✅ Resolved after ${turn} turn(s).`);
        break;
      }

      // ── 8. Prepare next turn ───────────────────────────────────────────
      if (decision.actionButtonToClick) {
        nextButtonToClick = decision.actionButtonToClick;
      } else if (decision.nextReply) {
        currentMessage = decision.nextReply;
      } else {
        // No follow-up generated AND not satisfied/declined → stop rather than looping
        console.log('[AI Agent] No follow-up generated and no clear outcome — treating as decline to prevent infinite loop.');
        declined = true;
        declineReason = 'Agent had no follow-up to send and the issue was not resolved.';
        break;
      }

      turn++;
    }

    const totalSec = Math.round((Date.now() - conversationStart) / 1000);
    const outcome = isSatisfied ? '✅ RESOLVED' : declined ? '🚫 DECLINED/TERMINATED' : `⚠ MAX TURNS (${maxTurns}) REACHED`;
    console.log(`\n${'='.repeat(65)}`);
    console.log(`[AI Agent] DONE — ${outcome} | turns: ${turn} | time: ${totalSec}s`);
    if (anyFallbackUsed) console.log(`[AI Agent] ⚠ Heuristic fallback used (no live OpenAI — add OPENAI_API_KEY for reliable evaluation).`);
    console.log(`${'='.repeat(65)}\n`);

    return {
      isSatisfied,
      declined,
      declineReason,
      turnsCompleted: Math.min(turn, maxTurns),
      conversationHistory,
      usedFallback: anyFallbackUsed,
    };
  }

  /**
   * Complete standard Wi-Fi guided troubleshooting flow.
   * @param {string[]} queries
   */
  async runTroubleshootingFlow(queries) {
    for (const query of queries) {
      await this.sendMessage(query);
    }
  }
}

module.exports = AIHelpdeskPage;
