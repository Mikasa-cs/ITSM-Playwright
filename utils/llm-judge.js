// @ts-check
/**
 * llm-judge.js
 * -----------------------------------------------------------------------
 * Playwright can only pattern-match text — it has no understanding of
 * whether an AI chatbot's reply is actually correct, relevant, or
 * "intelligent". This util closes that gap by sending the bot's reply to
 * a real LLM (OpenAI) and asking it to grade the reply against criteria
 * you define per test. Playwright then asserts on that verdict.
 *
 * Requires OPENAI_API_KEY in your .env file.
 * -----------------------------------------------------------------------
 */

const JUDGE_MODEL = process.env.LLM_JUDGE_MODEL || 'gpt-4o-mini';
const API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * @typedef {Object} JudgeVerdict
 * @property {boolean} pass
 * @property {number} score        - 0-10 confidence/quality score
 * @property {string} reason       - short explanation for the verdict
 */

/**
 * Ask an LLM to judge whether a chatbot's reply is correct/relevant.
 *
 * @param {Object} params
 * @param {string} params.userQuestion   - what the user asked the bot
 * @param {string} params.botReply       - the bot's actual reply text
 * @param {string} params.criteria       - what a correct reply must do,
 *                                          e.g. "Must mention resetting
 *                                          the router and contacting IT
 *                                          if unresolved."
 * @returns {Promise<JudgeVerdict>}
 */
async function judgeReply({ userQuestion, botReply, criteria }) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error(
            'OPENAI_API_KEY is not set. Add it to your .env file to use llm-judge.'
        );
    }

    const systemPrompt =
        'You are a strict QA grader for an IT helpdesk AI chatbot. ' +
        'You will be given the user question, the bot\'s reply, and the ' +
        'criteria a correct reply must satisfy. Reply with ONLY a JSON object ' +
        '(no markdown, no prose) in this exact shape: ' +
        '{"pass": boolean, "score": number (0-10), "reason": string}. ' +
        'Be strict: a vague, generic, or off-topic reply should fail even if ' +
        'it sounds polite.';

    const userPrompt =
        `User question: ${userQuestion}\n\n` +
        `Bot reply: ${botReply}\n\n` +
        `Criteria for a correct reply: ${criteria}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: JUDGE_MODEL,
            max_tokens: 300,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`LLM judge API call failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const rawText = (data.choices?.[0]?.message?.content || '').trim();

    const cleaned = rawText.replace(/^```json|```$/g, '').trim();

    /** @type {JudgeVerdict} */
    let verdict;
    try {
        verdict = JSON.parse(cleaned);
    } catch (err) {
        throw new Error(`LLM judge returned non-JSON output: "${rawText}"`);
    }

    if (typeof verdict.pass !== 'boolean') {
        throw new Error(`LLM judge verdict missing "pass" boolean: ${cleaned}`);
    }

    return verdict;
}

module.exports = { judgeReply };
