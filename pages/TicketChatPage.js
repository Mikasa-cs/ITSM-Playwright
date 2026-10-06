// @ts-check
/**
 * TicketChatPage.js
 * ─────────────────────────────────────────────────────────────────────
 * Page Object for the ticket detail chatbox / comments section.
 * Works for both IT Staff (Ticket Queue) and Employee (My Tickets) views.
 *
 * Core responsibilities:
 *  - Extract ticket context (ID, subject, description) from the open page
 *  - Read all current chat messages
 *  - Send a message via the chatbox
 *  - Poll for new real-time messages without refreshing the page
 *  - Scroll to the chatbox at the bottom of the ticket detail
 * ─────────────────────────────────────────────────────────────────────
 */

const { expect } = require('@playwright/test');

/**
 * @typedef {Object} ChatMessage
 * @property {string} sender      - Sender's display name or role label
 * @property {string} text        - Message body
 * @property {string} [timestamp] - Raw timestamp string from the UI if present
 * @property {number} [capturedAt] - Performance.now() when captured
 */

class TicketChatPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // ── Chat input area ─────────────────────────────────────────────
    // The app uses #ticket-comment or a placeholder-based textarea
    this.chatInput = page.locator('#ticket-comment')
      .or(page.getByPlaceholder(/type.*message|write a message|post a response|add a comment/i))
      .or(page.locator('textarea[name="comment"]'))
      .or(page.locator('textarea').last());

    // ── Send button ─────────────────────────────────────────────────
    this.sendBtn = page.locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /^send$/i }))
      .or(page.getByRole('button', { name: /send message/i }));

    // ── Chat container (wraps all visible messages) ──────────────────
    // Try progressive selectors — most specific first
    this.chatContainer = page.locator('[class*="chat"]')
      .or(page.locator('[class*="message"]'))
      .or(page.locator('[class*="comment"]'))
      .or(page.locator('section').last())
      .first();
  }

  // ─── Ticket Context ────────────────────────────────────────────────

  /**
   * Extract the ticket context from the currently open ticket detail page.
   * Returns the ticket ID (INC-XXXX), subject, and description.
   *
   * @returns {Promise<import('../utils/ticket-chat-agent').TicketContext>}
   */
  async getTicketContext() {
    const ctx = await this.page.evaluate(() => {
      // Ticket ID — look for INC-XXXX pattern anywhere visible
      const allText = document.body.innerText || '';
      const idMatch = allText.match(/INC-\d{4,}/);
      const ticketId = idMatch ? idMatch[0] : 'UNKNOWN';

      // Subject — first h1/h2/h3 on the page that isn't a navigation header
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, [class*="title"], [class*="subject"]'));
      const subject = headings
        .map((el) => (el.textContent || '').trim())
        .find((t) => t.length > 3 && !/dashboard|ticket queue|my tickets|knowledge/i.test(t)) || 'IT Support Ticket';

      // Description — look for a description/details paragraph
      const descCandidates = Array.from(document.querySelectorAll(
        '[class*="description"], [class*="detail"], p, [class*="body"]'
      ));
      const description = descCandidates
        .map((el) => (el.textContent || '').trim())
        .find((t) => t.length > 10 && !/dashboard|navigation|sign in|sign out/i.test(t)) || subject;

      return { ticketId, subject, description };
    });

    console.log(`[TicketChatPage] Extracted context — ID: ${ctx.ticketId} | Subject: ${ctx.subject}`);
    return ctx;
  }

  // ─── Message Reading ───────────────────────────────────────────────

  /**
   * Return all currently visible chat messages in the ticket.
   * Avoids returning nav text, button labels, or form placeholders.
   *
   * @returns {Promise<ChatMessage[]>}
   */
  async getMessages() {
    return await this.page.evaluate(() => {
      /** @type {{ sender: string, text: string, timestamp: string, capturedAt: number }[]} */
      const messages = [];

      // Strategy 1: target timeline comment items in the ticket workspace
      const timelineItems = Array.from(document.querySelectorAll(
        '.relative.pl-8, [class*="message-bubble"], [class*="chat-bubble"], [class*="msg-item"], ' +
        '[class*="comment-item"], [class*="reply-item"], [class*="conversation-item"]'
      ));

      if (timelineItems.length > 0) {
        timelineItems.forEach((el) => {
          const pEl = el.querySelector('p');
          const text = (pEl ? pEl.textContent : el.textContent || '').trim();
          if (!text || text.length < 2) return;

          const senderEl = el.querySelector('[class*="text-[10px]"], [class*="font-semibold"], strong, b');
          const sender = (senderEl?.textContent || '').trim() || 'User';

          const timeEl = el.querySelector('time, [class*="text-tertiary"], [class*="text-[10px]"]');
          const timestamp = (timeEl?.textContent || '').trim();

          messages.push({ sender, text, timestamp, capturedAt: Date.now() });
        });
        return messages;
      }

      // Strategy 2: fallback — find elements in the chat area that look like message text
      const candidates = Array.from(document.querySelectorAll('div, p, li'))
        .filter((el) => {
          if (el.closest('form') || el.closest('button') || el.closest('nav') || el.closest('header')) return false;
          if (el.closest('[class*="sidebar"]') || el.closest('[class*="nav"]')) return false;
          const text = (el.textContent || '').trim();
          return text.length > 3 &&
            !/dashboard|ticket queue|my tickets|knowledge base|sign in|sign out|send|placeholder/i.test(text);
        });

      candidates.forEach((el) => {
        const text = (el.textContent || '').trim();
        if (!text || messages.some((m) => m.text === text)) return;
        messages.push({ sender: 'unknown', text, timestamp: '', capturedAt: Date.now() });
      });

      return messages;
    });
  }

  // ─── Sending ───────────────────────────────────────────────────────

  /**
   * Type a message into the chatbox and click Send (or press Enter).
   * @param {string} text
   */
  async sendMessage(text) {
    await this.scrollToChat();

    // Wait for input to be visible and interactable
    const input = this.chatInput.first();
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.click();
    await input.fill('');                            // clear first
    await input.pressSequentially(text, { delay: 40 });

    await this.page.waitForTimeout(400);             // brief settle before sending

    // Prefer submit button; fall back to Enter
    const btn = this.sendBtn.first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
    } else {
      await this.page.keyboard.press('Enter');
    }

    // Give the UI a moment to render the sent message
    await this.page.waitForTimeout(800);
  }

  // ─── Real-Time Polling ─────────────────────────────────────────────

  /**
   * Poll the chat until a NEW message appears that was not in `knownMessages`.
   * This is the core real-time verification mechanism — NO page.reload() is called.
   *
   * @param {ChatMessage[]} knownMessages   - Message list captured BEFORE the other side sent
   * @param {{ timeout?: number, pollIntervalMs?: number }} [options]
   * @returns {Promise<{ message: ChatMessage, deliveryLatencyMs: number, refreshRequired: boolean }>}
   */
  async waitForNewMessage(knownMessages, { timeout = 30000, pollIntervalMs = 500 } = {}) {
    const startTime = Date.now();
    const knownTexts = new Set(knownMessages.map((m) => m.text));

    console.log(`[TicketChatPage] Polling for new message (timeout: ${timeout / 1000}s, known: ${knownMessages.length} messages)...`);

    while (Date.now() - startTime < timeout) {
      const current = await this.getMessages();
      const newMsg = current.find((m) => !knownTexts.has(m.text) && m.text.length > 2);

      if (newMsg) {
        const deliveryLatencyMs = Date.now() - startTime;
        console.log(`[TicketChatPage] ✓ New message detected in ${deliveryLatencyMs}ms (NO refresh needed)`);
        console.log(`[TicketChatPage]   Sender: ${newMsg.sender} | Text: "${newMsg.text.slice(0, 80)}..."`);
        return { message: newMsg, deliveryLatencyMs, refreshRequired: false };
      }

      await this.page.waitForTimeout(pollIntervalMs);
    }

    // Timed out without real-time delivery — still try after a reload for diagnostic purposes
    console.warn(`[TicketChatPage] ⚠ No new message detected within ${timeout / 1000}s without refresh. Attempting reload check...`);
    await this.page.reload();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.scrollToChat();

    const afterReload = await this.getMessages();
    const recoveredMsg = afterReload.find((m) => !knownTexts.has(m.text) && m.text.length > 2);

    if (recoveredMsg) {
      const deliveryLatencyMs = Date.now() - startTime;
      console.warn(`[TicketChatPage] ✗ Message found ONLY after page reload (latency: ${deliveryLatencyMs}ms)`);
      return { message: recoveredMsg, deliveryLatencyMs, refreshRequired: true };
    }

    throw new Error(`[TicketChatPage] No new message appeared after ${timeout / 1000}s (even after reload).`);
  }

  // ─── Navigation ────────────────────────────────────────────────────

  /**
   * Scroll to the chatbox section at the bottom of the ticket detail page.
   */
  async scrollToChat() {
    // Scroll to bottom of page where chat typically lives
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForTimeout(500);

    // Then wait for the chat input to be at least in the DOM
    await this.chatInput.first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  }

  /**
   * Verify that the received message text matches the sent text (content integrity check).
   * @param {string} sentText
   * @param {string} receivedText
   * @returns {{ match: boolean, details: string }}
   */
  verifyMessageMatch(sentText, receivedText) {
    // Normalize whitespace for comparison
    const normalize = (/** @type {string} */ s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const sent = normalize(sentText);
    const recv = normalize(receivedText);

    const match = recv.includes(sent) || sent.includes(recv) || recv === sent;
    return {
      match,
      details: match
        ? `✓ Content match: "${sentText.slice(0, 60)}"`
        : `✗ Content mismatch — Sent: "${sent.slice(0, 60)}" | Received: "${recv.slice(0, 60)}"`,
    };
  }
}

module.exports = TicketChatPage;
