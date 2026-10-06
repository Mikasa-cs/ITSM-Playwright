// @ts-check
/**
 * llm-agent.js
 * -----------------------------------------------------------------------
 * Autonomous conversational agent engine that tests the AI Helpdesk Copilot.
 * Analyzes the chatbot's responses against the user's problem, determines
 * if the solution is satisfactory, and dynamically crafts contextual follow-up
 * replies until the issue is resolved.
 * -----------------------------------------------------------------------
 */

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

/**
 * @typedef {Object} ConversationTurn
 * @property {string} user
 * @property {string} bot
 */

/**
 * @typedef {Object} AgentDecision
 * @property {string} analysis            - Thought process analyzing the bot's reply
 * @property {boolean} isSatisfied        - True if the bot has satisfactorily resolved the problem
 * @property {boolean} declined           - True if the bot explicitly said it cannot resolve/understand/answer the query (a legitimate response in its own right, not a failure to force past)
 * @property {number} satisfactionScore   - 0 to 10 score on how well the issue is solved
 * @property {string} reason              - Why the solution is or isn't satisfactory
 * @property {string|null} nextReply      - The follow-up message to send to the chatbot (null when declined - we do not push for a resolution once the bot has said it can't help)
 * @property {string|null} actionButtonToClick - Button text to click if an action button is best
 * @property {boolean} [usedFallback]          - True when the heuristic fallback was used instead of a live LLM
 */

/**
 * Detects whether the bot's reply is an explicit statement that it cannot
 * resolve/understand/answer the query - as opposed to a normal troubleshooting
 * step, a clarifying question, or a real resolution. This is intentionally a
 * *category* match (several equivalent phrasings), not a hardcoded exact
 * string, per the "response evaluation must remain dynamic" requirement.
 *
 * @param {string} replyLower - the bot's reply, already lowercased
 * @returns {boolean}
 */
function isExplicitDecline(replyLower) {
  const patterns = [
    /\bi\s*(?:'m| am)?\s*(?:cannot|can't|can not)\s+(?:resolve|understand|answer|assist|help)\b/i,
    /\bi\s+(?:don't|do not)\s+(?:have enough information|know how to resolve|understand)\b/i,
    /\b(?:unable|not able)\s+to\s+(?:resolve|understand|answer|assist|help)\b/i,
    /\bi\s*(?:'m| am)?\s*(?:unable|not able)\s+to\s+(?:assist|help|resolve)\b/i,
    /\b(?:cannot|can't|can not)\s+(?:be resolved|be answered)\b/i,
    /\boutside (?:my|the) (?:scope|capabilities)\b/i,
    /\bnot (?:something|able to be)\s+(?:i can|i'm able to)\s+(?:resolve|help with)\b/i,
    /\bplease (?:contact|reach out to|consult) (?:a human|support staff|your (?:it )?administrator)\b/i,
  ];
  return patterns.some((re) => re.test(replyLower));
}

/**
 * Heuristic cognitive fallback engine used when OpenAI quota is exhausted or API is offline.
 * Analyzes the bot reply contextually and formulates appropriate technical follow-ups.
 *
 * @param {Object} params
 * @param {string} params.problem
 * @param {ConversationTurn[]} params.conversationHistory
 * @param {string} params.latestBotReply
 * @param {string[]} params.availableButtons
 * @returns {AgentDecision}
 */
function heuristicReasoner({ problem, conversationHistory, latestBotReply, availableButtons = [] }) {
  const replyLower = latestBotReply.toLowerCase();
  const turnCount = conversationHistory.length;

  // 0. Explicit decline: the bot has plainly said it can't resolve/understand/
  //    answer this. That is a legitimate response in its own right - stop
  //    here rather than pushing a forced follow-up demanding a resolution.
  if (isExplicitDecline(replyLower)) {
    return {
      analysis: 'The AI Helpdesk explicitly stated it cannot resolve, understand, or answer this query.',
      isSatisfied: false,
      declined: true,
      satisfactionScore: 5,
      reason: 'This is treated as the chatbot\'s legitimate final response, not a failure to force past - whether that counts as a pass depends on what the test case expects.',
      nextReply: null,
      actionButtonToClick: null,
    };
  }

  // Check if bot presented a resolved option button
  // (guarded against "Not Resolved" / "Issue Not Fixed" style buttons, which
  // contain the word "resolved"/"fixed" but mean the opposite)
  const resolvedBtn = availableButtons.find(
    (b) => !/\bnot\b/i.test(b) && /yes.*resolved|resolved|issue fixed/i.test(b)
  );
  // NOTE: word boundaries are required here. A plain /no/i substring match
  // (no \b) previously matched "Knowledge Base" (...k-NO-wledge...) as if it
  // were a "try another step / not resolved" button, causing the agent to
  // click into Knowledge Base regardless of whether the issue was addressed.
  const anotherStepBtn = availableButtons.find((b) =>
    /\banother step\b|\btry\b.*\bstep\b|^\s*no\s*$|\bnot resolved\b/i.test(b)
  );

  // 1. Solution indicator: Bot provided a clear solution or resolution confirmation
  if (
    resolvedBtn ||
    replyLower.includes('has been resolved') ||
    replyLower.includes('ticket has been created') ||
    replyLower.includes('access has been granted') ||
    replyLower.includes('password has been reset') ||
    (turnCount >= 3 && (replyLower.includes('configured') || replyLower.includes('ready to use')))
  ) {
    return {
      analysis: 'The AI Helpdesk provided the solution or confirmation for the requested issue.',
      isSatisfied: true,
      declined: false,
      satisfactionScore: 9,
      reason: 'The chatbot gave actionable troubleshooting instructions or confirmed resolution.',
      nextReply: 'Thank you, that solved my issue!',
      actionButtonToClick: resolvedBtn || null,
    };
  }

  // 2. Wi-Fi Troubleshooting Context
  if (/wi-?fi|internet|network|speed/i.test(problem)) {
    if (replyLower.includes('5ghz') || replyLower.includes('frequency') || replyLower.includes('band')) {
      return {
        analysis: 'The bot is asking for network band details (2.4GHz vs 5GHz).',
        isSatisfied: false,
        declined: false,
        satisfactionScore: 5,
        reason: 'Troubleshooting in progress; bot requested network frequency info.',
        nextReply: 'I am currently connected to the 5GHz enterprise network.',
        actionButtonToClick: null,
      };
    }
    if (replyLower.includes('restart') || replyLower.includes('reboot') || replyLower.includes('adapter')) {
      return {
        analysis: 'The bot suggested restarting the network adapter or router.',
        isSatisfied: false,
        declined: false,
        satisfactionScore: 6,
        reason: 'Bot provided initial troubleshooting step. Verifying outcome.',
        nextReply: 'I restarted the adapter, but the speed drops every 10 minutes.',
        actionButtonToClick: anotherStepBtn || null,
      };
    }
  }

  // 3. Software Access / License Request Context
  if (/software|access|license|figma|docker/i.test(problem)) {
    if (replyLower.includes('wi-fi') || replyLower.includes('office')) {
      return {
        analysis: 'The bot gave an irrelevant Wi-Fi response instead of software license instructions.',
        isSatisfied: false,
        declined: false,
        satisfactionScore: 2,
        reason: 'Response does not address software procurement or license requests.',
        nextReply: 'I am already on office Wi-Fi. I specifically need approval for Docker and Figma software access.',
        actionButtonToClick: null,
      };
    }
    if (replyLower.includes('portal') || replyLower.includes('service catalog') || replyLower.includes('form') || replyLower.includes('ticket')) {
      return {
        analysis: 'The bot guided me to the service catalog / IT ticket form for software approval.',
        isSatisfied: true,
        declined: false,
        satisfactionScore: 9,
        reason: 'Provided the correct portal/procedure to request enterprise software access.',
        nextReply: 'Understood, I will submit the request through the IT service catalog form. Thank you!',
        actionButtonToClick: resolvedBtn || null,
      };
    }
  }

  // 4. VPN / Authentication / SSO Lockout Context
  if (/vpn|okta|sso|login|lockout/i.test(problem)) {
    if (replyLower.includes('credentials') || replyLower.includes('username') || replyLower.includes('mfa')) {
      return {
        analysis: 'The bot is asking for authentication or MFA verification details.',
        isSatisfied: false,
        declined: false,
        satisfactionScore: 6,
        reason: 'Bot is investigating credential verification steps.',
        nextReply: 'My MFA push notification is not triggering on my mobile device.',
        actionButtonToClick: anotherStepBtn || null,
      };
    }
  }

  // 5. If another step button is available and issue isn't solved yet
  if (anotherStepBtn && turnCount < 4) {
    return {
      analysis: 'The bot provided an initial step and offered an option to try another step.',
      isSatisfied: false,
      declined: false,
      satisfactionScore: 5,
      reason: 'First step did not fully solve the problem; proceeding to next recommendation.',
      nextReply: 'That step did not resolve it, please provide the next step.',
      actionButtonToClick: anotherStepBtn,
    };
  }

  // Default: heuristic has no pattern match for this reply.
  // Return declined=true so conductAutonomousChat exits cleanly instead of
  // re-sending vague prompts until maxTurns. Without OPENAI_API_KEY the
  // fallback has no semantic understanding — terminating is the honest outcome.
  return {
    analysis: 'No resolution signal detected and heuristic has no contextual follow-up for this reply.',
    isSatisfied: false,
    declined: true,
    satisfactionScore: 3,
    reason: 'Heuristic fallback terminated to prevent infinite loop. Add OPENAI_API_KEY for reliable LLM-based evaluation.',
    nextReply: null,
    actionButtonToClick: null,
  };
}


/**
 * Analyze the AI Helpdesk's reply against the user's issue and decide the next response.
 * Uses OpenAI if an active key is present; gracefully falls back to cognitive heuristic reasoner if quota is exhausted.
 *
 * @param {Object} params
 * @param {string} params.problem              - The user's core issue/problem statement
 * @param {ConversationTurn[]} params.conversationHistory - Prior turns
 * @param {string} params.latestBotReply       - Latest response from the AI Helpdesk Copilot
 * @param {string[]} [params.availableButtons] - Any visible option/action buttons
 * @returns {Promise<AgentDecision>}
 */
async function analyzeAndGenerateReply({ problem, conversationHistory, latestBotReply, availableButtons = [] }) {
  // If OpenAI key is available, attempt live LLM call
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    try {
      const systemPrompt =
        'You are an intelligent QA tester interacting with an IT Helpdesk AI Copilot chatbot. ' +
        'Your goal is to test whether the chatbot effectively resolves the following IT problem:\n' +
        `PROBLEM: "${problem}"\n\n` +
        'Evaluate the chatbot\'s reply:\n' +
        '1. Did the chatbot provide the actual, working solution or direct resolution instructions for the problem?\n' +
        '2. If YES: set isSatisfied to true, declined to false, provide satisfactionScore (8-10), and explain why.\n' +
        '3. Did the chatbot instead explicitly say it CANNOT resolve/understand/answer this query (in any equivalent wording - ' +
        '"I cannot resolve this", "I don\'t have enough information", "I am unable to assist", "I don\'t know how to resolve this", etc.)? ' +
        'If YES: set isSatisfied to false, declined to true, nextReply to null, and do NOT invent a forceful follow-up demanding a resolution - ' +
        'that is a legitimate response from the chatbot, not something to push past.\n' +
        '4. Otherwise (still mid-troubleshooting, asking a clarifying question, etc.): set isSatisfied to false, declined to false, ' +
        'explain what is missing, and generate a concise, realistic follow-up reply to continue the conversation.\n' +
        '5. If buttons are provided and appropriate, specify actionButtonToClick.\n\n' +
        'Respond ONLY in valid JSON matching this structure:\n' +
        '{"analysis": string, "isSatisfied": boolean, "declined": boolean, "satisfactionScore": number (0-10), "reason": string, "nextReply": string|null, "actionButtonToClick": string|null}';

      const userContent = JSON.stringify({
        problem,
        history: conversationHistory,
        latestBotReply,
        availableButtons,
      });

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 350,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          const parsed = JSON.parse(content);
          const declined = Boolean(parsed.declined) || isExplicitDecline(String(latestBotReply || '').toLowerCase());
          return {
            analysis: parsed.analysis || 'Analyzed via OpenAI.',
            isSatisfied: Boolean(parsed.isSatisfied),
            declined,
            satisfactionScore: Number(parsed.satisfactionScore) || 5,
            reason: parsed.reason || '',
            nextReply: declined ? null : (parsed.nextReply || 'Could you provide more details?'),
            actionButtonToClick: parsed.actionButtonToClick || null,
            usedFallback: false,
          };
        }
      } else {
        const errText = await response.text().catch(() => '');
        console.log(`[LLM Agent Notice] OpenAI API returned ${response.status} (${errText.slice(0, 80)}...). Utilizing built-in cognitive reasoner.`);
      }
    } catch (err) {
      console.log('[LLM Agent Notice] Error calling OpenAI API. Utilizing built-in cognitive reasoner.');
    }
  }

  // Built-in cognitive reasoner fallback
  return {
    ...heuristicReasoner({ problem, conversationHistory, latestBotReply, availableButtons }),
    usedFallback: true, // this turn was NOT evaluated by a real LLM - flag it so it's visible in logs
  };
}

module.exports = {
  analyzeAndGenerateReply,
  isExplicitDecline,
};
