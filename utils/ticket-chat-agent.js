// @ts-check
/**
 * ticket-chat-agent.js
 * ─────────────────────────────────────────────────────────────────────
 * Drives the dual-sided ticket conversation test.
 *
 * Provides three exported functions:
 *   generateITStaffMessage()   → contextual IT question for the employee
 *   generateEmployeeResponse() → plausible employee answer to IT's question
 *   analyzeConversation()      → decide whether the issue is resolved
 *
 * Uses OpenAI gpt-4o-mini when the key is valid; gracefully falls back
 * to a domain-aware heuristic engine (no external dependency required).
 * ─────────────────────────────────────────────────────────────────────
 */

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL   = process.env.LLM_MODEL || 'gpt-4o-mini';

// ─── OpenAI helper ────────────────────────────────────────────────────

/**
 * @param {string} systemPrompt
 * @param {string} userContent
 * @returns {Promise<string|null>}
 */
async function callOpenAI(systemPrompt, userContent) {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent  },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
    const errText = await res.text().catch(() => '');
    console.log(`[TicketChatAgent] OpenAI ${res.status}: ${errText.slice(0, 80)} → heuristic fallback`);
    return null;
  } catch {
    console.log('[TicketChatAgent] OpenAI unavailable → heuristic fallback');
    return null;
  }
}

// ─── Domain Heuristic Engine ──────────────────────────────────────────

/**
 * @typedef {Object} ChatTurn
 * @property {'itstaff'|'employee'} sender
 * @property {string} text
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} TicketContext
 * @property {string} ticketId
 * @property {string} subject
 * @property {string} description
 * @property {string} [category]
 * @property {string} [priority]
 */

/** Detect ticket domain from description/subject
 * @param {TicketContext} ctx
 * @returns {'vpn'|'wifi'|'printer'|'auth'|'software'|'general'}
 */
function detectDomain(ctx) {
  const s = `${ctx.subject} ${ctx.description}`.toLowerCase();
  if (/vpn|globalprotect|tunnel|remote access/i.test(s))         return 'vpn';
  if (/wi-?fi|wireless|internet|network|speed|latency/i.test(s)) return 'wifi';
  if (/printer|print|beep|paper|jam/i.test(s))                   return 'printer';
  if (/okta|sso|login|password|locked|authentication|mfa/i.test(s)) return 'auth';
  if (/software|install|license|figma|docker|access|tool/i.test(s)) return 'software';
  // email, hardware, and unknown → general
  return 'general';
}

/** IT Staff question bank — indexed by domain, then conversation turn */
const IT_QUESTIONS = {
  vpn: [
    'Can you confirm which VPN client you are using (e.g., GlobalProtect, Cisco AnyConnect) and what version is installed?',
    'What error message or code do you see when the VPN connection drops? Does it give any specific reason?',
    'Is the disconnection happening on a specific network (home Wi-Fi vs. mobile hotspot), or on all networks?',
    'Have you tried reinstalling the VPN client? Can you also confirm your OS and VPN client are both up to date?',
    'Could you confirm whether other users at your location are experiencing the same VPN issue?',
    'Thank you for all the details. The gateway config has been pushed. Can you confirm the connection is now stable?',
  ],
  wifi: [
    'Can you confirm which Wi-Fi network you are connected to — is it the 5GHz enterprise network or the 2.4GHz guest network?',
    'How frequently does the speed fluctuate? Does it happen at specific times of day or continuously?',
    'Have you tried forgetting the network and reconnecting? Does the issue persist after a full device restart?',
    'Can you check if other devices on the same network experience the same speed fluctuation?',
    'What is the distance between your workstation and the nearest access point? Any physical barriers between?',
    'I have updated the AP channel configuration. Please confirm whether the speed is now stable.',
  ],
  printer: [
    'Can you describe the beeping pattern — how many beeps and at what interval? Any error message on the printer display?',
    'Is the paper tray fully loaded and properly aligned? Can you check for any paper jam indicators?',
    'Which printer model is this, and is it connected via USB or network? Are other users also unable to print?',
    'Have you tried turning the printer off, waiting 30 seconds, and turning it back on?',
    'Can you check the ink or toner levels from the printer settings panel?',
    'A firmware update has been pushed to the printer. Please confirm whether the beeping has stopped.',
  ],
  auth: [
    'Are you getting a specific error message when trying to log in? For example, "Invalid credentials" or "Account locked"?',
    'Is this affecting only Okta SSO, or are you also unable to log in to other company applications?',
    'Can you confirm if your MFA push notification is arriving on your mobile device?',
    'When did you last successfully log in? Did anything change on your device or account recently?',
    'Have you tried using an incognito/private browser window to rule out a browser cache issue?',
    'I have reset your Okta session and verified MFA. Please try logging in again and confirm.',
  ],
  software: [
    'Which software or tool are you trying to access? Can you confirm the exact application name and version you need?',
    'Is this a new installation request or are you having trouble accessing software you previously had?',
    'Do you have a business justification or project requirement for this software? That is needed for approval.',
    'Have you raised a request through the IT Service Catalog? If not, I can guide you through the process.',
    'I have submitted the license request on your behalf. Approval is pending from your department head.',
    'The software license has been approved and provisioned. Please confirm you now have access.',
  ],
  general: [
    'Could you describe the issue in more detail? When did it first occur, and what were you doing at that time?',
    'Have you already tried any troubleshooting steps on your own? If so, what were the results?',
    'Is this issue affecting only your machine, or have other colleagues reported something similar?',
    'What is the make and model of your device, and which operating system version are you running?',
    'Does the issue occur consistently or intermittently? Have you noticed any specific pattern?',
    'Based on everything you have described, I have enough information to proceed. I will follow up shortly.',
  ],
};

/** Employee answer bank — indexed by domain, then turn */
const EMPLOYEE_ANSWERS = {
  vpn: [
    'I am using GlobalProtect version 6.2.1. The disconnections happen several times a day.',
    'The error says "Gateway connection failed" and the session drops without any warning.',
    'It happens on both my home Wi-Fi and mobile hotspot, so it seems unrelated to my local network.',
    'I tried reinstalling yesterday but the problem persisted. My OS is Windows 11, fully updated.',
    'Yes, two colleagues at my location are reporting the same issue starting this morning.',
    'The VPN has been stable for the past 15 minutes now. It looks like the fix worked! Thank you.',
  ],
  wifi: [
    'I am on the 5GHz enterprise network — the one named CORP_SECURE.',
    'The speed drops every 10 to 15 minutes, going from 90 Mbps down to under 5 Mbps for about a minute.',
    'Yes, I tried forgetting and reconnecting and also restarted the laptop. Still happening.',
    'My colleague at the adjacent desk has the same issue. The colleague on the other side of the room does not.',
    'I am about 8 meters from the nearest access point with a glass partition in between.',
    'The connection has been stable for the last 20 minutes. Speed is consistently above 80 Mbps now. Thank you!',
  ],
  printer: [
    'It beeps 4 times rapidly when I send any print job. The display shows "Error Code E3".',
    'The paper tray looks fine and there is no jam indicator on the display.',
    'It is the HP LaserJet Pro M404dn, connected via the office network. Others also cannot print to it.',
    'Yes, I tried turning it off and on. The beeping comes back as soon as I send a print job.',
    'Toner is at 45% and there is plenty of paper loaded. The issue seems unrelated to supplies.',
    'It seems to be printing normally now without any beeping. Thank you for the firmware update!',
  ],
  auth: [
    'It says "Access denied. Please contact your IT administrator." I cannot get past the login screen.',
    'Yes, both Okta and all other company apps are inaccessible. My email is also not loading.',
    'No MFA push notification on my phone. I have waited 5 minutes and tried resending multiple times.',
    'I last logged in successfully on Friday. I did not change anything over the weekend.',
    'I just tried in incognito mode — same error. So it is not a browser cache issue.',
    'It worked! I can log in now and the MFA push arrived instantly. Thank you so much!',
  ],
  software: [
    'I need Docker Desktop and Figma. Both are required for a product design sprint starting next week.',
    'This is a new installation request. I do not have either tool on my current machine.',
    'Yes, my manager has already verbally approved it. The sprint involves both development and design review.',
    'I was not aware of the Service Catalog process. Can you share the link or walk me through it?',
    'Thank you. I will wait for department head approval. Please keep me posted on the expected timeline.',
    'I can now see Docker Desktop and Figma in my software portal. Installing now! Great help, thanks.',
  ],
  general: [
    'The issue started this morning when I tried to access the internal project management portal.',
    'I tried restarting my browser and clearing the cache, but the problem still persisted.',
    'As far as I know, only I am affected. My colleagues seem to be working fine.',
    'I have a Dell Latitude 5520, running Windows 11 Pro version 23H2.',
    'It happens every time I try — I have not found any specific pattern or trigger yet.',
    'That sounds good. Please let me know once you have a resolution. I appreciate your help.',
  ],
};

// ─── Exported Functions ───────────────────────────────────────────────

/**
 * Generate an IT Staff message (question/clarification) for the employee.
 * @param {TicketContext} ticketContext
 * @param {ChatTurn[]} conversationHistory
 * @returns {Promise<string>}
 */
async function generateITStaffMessage(ticketContext, conversationHistory) {
  const turnIndex = conversationHistory.filter((t) => t.sender === 'itstaff').length;

  const systemPrompt =
    'You are an experienced IT Support Agent handling the following support ticket:\n' +
    `ID: ${ticketContext.ticketId}  Subject: ${ticketContext.subject}\n` +
    `Description: ${ticketContext.description}\n\n` +
    'Generate the single most relevant next question or instruction to gather information from the employee.\n' +
    'Keep it professional, concise (1-2 sentences), and directly related to diagnosing this specific issue.\n' +
    'Do NOT repeat questions already answered in the conversation.\n' +
    'JSON: {"message": string, "purpose": string, "issue_resolved": false}';

  const userContent = JSON.stringify({
    conversationHistory: conversationHistory.map((t) => `${t.sender === 'itstaff' ? 'IT Staff' : 'Employee'}: ${t.text}`),
    turnIndex,
  });

  const raw = await callOpenAI(systemPrompt, userContent);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.message && typeof parsed.message === 'string') return parsed.message;
    } catch { /* fall through */ }
  }

  const domain = detectDomain(ticketContext);
  const questions = IT_QUESTIONS[domain] ?? IT_QUESTIONS.general;
  return questions[Math.min(turnIndex, questions.length - 1)];
}

/**
 * Generate an Employee response to the IT Staff's latest message.
 * @param {TicketContext} ticketContext
 * @param {ChatTurn[]} conversationHistory
 * @param {string} itStaffMessage
 * @returns {Promise<string>}
 */
async function generateEmployeeResponse(ticketContext, conversationHistory, itStaffMessage) {
  const turnIndex = conversationHistory.filter((t) => t.sender === 'employee').length;

  const systemPrompt =
    'You are an employee who raised the following IT support ticket:\n' +
    `ID: ${ticketContext.ticketId}  Subject: ${ticketContext.subject}\n` +
    `Description: ${ticketContext.description}\n\n` +
    'The IT Support agent has sent you a message. Respond naturally (1-3 sentences).\n' +
    'Your response must be plausible given the ticket description and the question asked.\n' +
    'JSON: {"message": string, "issue_resolved": boolean}';

  const userContent = JSON.stringify({
    conversationHistory: conversationHistory.map((t) => `${t.sender === 'itstaff' ? 'IT Staff' : 'Employee'}: ${t.text}`),
    latestITStaffMessage: itStaffMessage,
    turnIndex,
  });

  const raw = await callOpenAI(systemPrompt, userContent);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.message && typeof parsed.message === 'string') return parsed.message;
    } catch { /* fall through */ }
  }

  const domain = detectDomain(ticketContext);
  const answers = EMPLOYEE_ANSWERS[domain] ?? EMPLOYEE_ANSWERS.general;
  return answers[Math.min(turnIndex, answers.length - 1)];
}

/**
 * Analyze the full conversation and determine if the issue is resolved/clarified.
 * @param {TicketContext} ticketContext
 * @param {ChatTurn[]} conversationHistory
 * @returns {Promise<{ isResolved: boolean, reason: string, summary: string }>}
 */
async function analyzeConversation(ticketContext, conversationHistory) {
  const exchangeCount = conversationHistory.filter((t) => t.sender === 'employee').length;

  const systemPrompt =
    'Analyze the IT support ticket conversation and determine whether:\n' +
    '1. The issue has been sufficiently understood AND a resolution path identified, OR\n' +
    '2. The employee has confirmed the issue is resolved.\n' +
    'JSON: {"isResolved": boolean, "reason": string, "summary": string}';

  const userContent = JSON.stringify({
    ticket: ticketContext,
    conversation: conversationHistory.map((t) => `${t.sender === 'itstaff' ? 'IT Staff' : 'Employee'}: ${t.text}`),
  });

  const raw = await callOpenAI(systemPrompt, userContent);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.isResolved === 'boolean') return parsed;
    } catch { /* fall through */ }
  }

  // Heuristic — check last employee message for resolution signals
  const lastEmployeeMsg = [...conversationHistory].reverse().find((t) => t.sender === 'employee');
  const text = (lastEmployeeMsg?.text || '').toLowerCase();
  const resolved =
    exchangeCount >= 5 ||
    /thank you|it worked|fixed|resolved|working now|stable|installed|confirmed|no more/i.test(text);

  return {
    isResolved: resolved,
    reason: resolved
      ? 'Employee confirmed resolution or sufficient diagnostic information has been collected.'
      : 'More information is still needed to fully resolve the issue.',
    summary: resolved
      ? `After ${exchangeCount} exchange(s), the issue was clarified and a resolution path confirmed.`
      : `Conversation ongoing — ${exchangeCount} exchange(s) completed so far.`,
  };
}

module.exports = {
  generateITStaffMessage,
  generateEmployeeResponse,
  analyzeConversation,
};
