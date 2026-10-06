// @ts-check
/**
 * llm-alerts.js
 * Uses OpenAI to generate dynamic, relevant system alerts for the Admin
 * dashboard. Falls back to a heuristic bank if the API is unavailable.
 */

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

function heuristicAlert(context) {
  context = context || [];
  const scenarios = [
    {
      title: 'High Ticket Volume Detected',
      message: 'The support queue has seen a spike in open tickets. IT Staff should prioritize critical tickets and employees are advised to check the self-service portal for common fixes.',
    },
    {
      title: 'Scheduled Maintenance Window Tonight',
      message: 'Planned infrastructure maintenance is scheduled from 11:00 PM to 2:00 AM. Services including email and VPN may be briefly interrupted. Please save your work before the window begins.',
    },
    {
      title: 'Password Policy Update Required',
      message: 'Company password policy has been updated. All users must reset passwords within 7 days to comply with the new 14-character minimum requirement. Contact IT Helpdesk for assistance.',
    },
    {
      title: 'Software License Renewal Alert',
      message: 'Several enterprise software licenses are due for renewal this week. Department heads should confirm team requirements by Friday so IT can process renewals without service interruption.',
    },
  ];
  const ctx = context.join(' ').toLowerCase();
  if (/vpn|network|wi-?fi/.test(ctx)) return scenarios[0];
  if (/maintenance|downtime|server/.test(ctx)) return scenarios[1];
  if (/password|login|auth/.test(ctx)) return scenarios[2];
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

async function generateAlert(params) {
  const systemContext = (params && params.systemContext) || [];
  const audience = (params && params.audience) || 'all';

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    try {
      const contextLine = systemContext.length > 0
        ? 'Recent system context: ' + systemContext.join(', ') + '.'
        : 'Generate a realistic, relevant enterprise IT alert.';

      const sysPrompt =
        'You are an IT System Administrator AI. Generate a concise professional system alert for ' + audience + ' users ' +
        'on an enterprise IT helpdesk dashboard. ' +
        'Respond ONLY with valid JSON (no markdown): {"title": string (max 60 chars), "message": string (1-3 sentences, actionable)}.';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 200,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: contextLine }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.title && parsed.message) {
            console.log('[LLM Alert] Generated: "' + parsed.title + '"');
            return { title: String(parsed.title).slice(0, 100), message: String(parsed.message) };
          }
        }
      } else {
        console.log('[LLM Alert] OpenAI returned ' + response.status + '. Using heuristic fallback.');
      }
    } catch (err) {
      console.log('[LLM Alert] API error:', err.message || err, '- using heuristic fallback.');
    }
  }

  const alert = heuristicAlert(systemContext);
  console.log('[LLM Alert] Heuristic fallback: "' + alert.title + '"');
  return alert;
}

module.exports = { generateAlert };
