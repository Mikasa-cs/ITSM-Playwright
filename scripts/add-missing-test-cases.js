#!/usr/bin/env node
// add-missing-test-cases.js
// Appends KPI-*, FP-*, CHAT-*, RTC-ITS-*, RTC-EMP-* test cases to ITSM_2_0_Test_Cases.xlsx
// Safe to re-run: skips already-existing IDs. Never modifies existing rows.
'use strict';

const path = require('path');
const fs   = require('fs');
const ExcelJS = require('exceljs');

const MASTER = path.join(__dirname, '..', 'ITSM_2_0_Test_Cases.xlsx');

function steps(arr) { return arr.map((s, i) => `${i + 1}. ${s}`).join('\n'); }

// ===== KPI TEST CASES (Admin Test Cases sheet) =====
const KPI_CASES = [
  { id:'KPI-001', desc:'Admin Dashboard KPI cards are visible on load',
    steps:steps(['Log in as Admin','Navigate to the Admin Dashboard','Observe the KPI summary cards section']),
    expected:'KPI cards (IT Staff MTTR, AI MTTR, First Contact Resolution, Staff On Leave) are visible and display numeric values',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-002', desc:'IT Staff MTTR dashboard value matches independently calculated value from ticket lifecycle data',
    steps:steps(['Log in as Admin and open the Admin Dashboard','Record the displayed IT Staff MTTR value','Navigate to Ticket Queue and iterate over every ticket','For each IT-Staff-resolved ticket: record open time and resolution time','Calculate MTTR = average(resolution time minus open time) in hours','Compare calculated value with dashboard value (tolerance 0.05)']),
    expected:'Calculated IT Staff MTTR matches dashboard value within 0.05 tolerance and all discovered tickets are processed',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-003', desc:'AI MTTR dashboard value matches independently calculated value from ticket lifecycle data',
    steps:steps(['Log in as Admin and open Admin Dashboard','Record displayed AI MTTR value','Navigate to Ticket Queue and iterate over every ticket','For each AI-resolved ticket: record open time and resolution time','Calculate AI MTTR = average(resolution time minus open time) in hours','Compare with dashboard value (tolerance 0.05)']),
    expected:'Calculated AI MTTR matches dashboard value within 0.05 tolerance and all discovered tickets are processed',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-004', desc:'IT Staff First Contact Resolution (FCR) dashboard value matches value calculated from ticket data',
    steps:steps(['Log in as Admin and open Admin Dashboard','Record displayed IT Staff First Contact Resolution percentage','Navigate to Ticket Queue and examine every IT-staff-handled ticket','Count tickets resolved without escalation or reassignment (first contact)','Calculate FCR = (first-contact resolved / total IT staff tickets) x 100','Compare with dashboard value (tolerance 0.05)']),
    expected:'Calculated FCR matches dashboard value within 0.05 tolerance and all discovered tickets are processed',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-005', desc:'IT Staff On Leave Today dashboard count matches the staff/leave list',
    steps:steps(['Log in as Admin and open Admin Dashboard','Record displayed IT Staff On Leave Today count','Click the KPI card to open the leave detail list','Count entries in the leave list','Compare list count with dashboard value']),
    expected:'Leave list count matches the dashboard IT Staff On Leave Today value exactly',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-006', desc:'KPI values update dynamically when new tickets are resolved',
    steps:steps(['Log in as Admin and record current IT Staff MTTR and FCR values','Create and resolve a new ticket via the IT Staff role','Return to Admin Dashboard','Re-read the KPI card values','Verify values have been recalculated to reflect the new ticket']),
    expected:'KPI values reflect the newly resolved ticket; values are not stale from cache',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'No' },
  { id:'KPI-007', desc:'KPI card navigation links open the correct detail view',
    steps:steps(['Log in as Admin and open Admin Dashboard','Click each KPI card one at a time','Verify the linked detail page or drill-down view loads','Return to Admin Dashboard after each click']),
    expected:'Each KPI card click opens the correct detail view without errors; back-navigation returns to the dashboard',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-008', desc:'KPI section renders correctly in different viewport sizes',
    steps:steps(['Log in as Admin','Resize viewport to tablet 1024x768 and verify KPI cards visible','Resize viewport to desktop 1920x1080 and verify KPI cards visible','Verify no KPI values are cut off or hidden by overflow']),
    expected:'KPI cards render correctly and all values are fully visible across supported viewport sizes',
    npm:'npm run test:admin:kpi', regression:'No', system:'Yes' },
  { id:'KPI-009', desc:'KPI Excel export includes KPI results, ticket data, and calculation metadata',
    steps:steps(['Run the KPI validation suite (npm run test:admin:kpi)','Open the generated KPI Results Excel sheet','Verify it contains one row per KPI: KPI Name, Dashboard Value, Calculated Value, Status, Notes','Open KPI Ticket Data sheet and verify one row per processed ticket: Ticket ID, Open Time, Close Time, Duration']),
    expected:'KPI Results sheet and KPI Ticket Data sheet both contain complete, accurate data matching the Playwright test run',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'Yes' },
  { id:'KPI-010', desc:'KPI validation handles tickets with missing lifecycle data gracefully',
    steps:steps(['Identify a ticket with an incomplete or missing resolution timestamp','Run IT Staff MTTR KPI test','Observe the test output for that ticket','Verify incomplete ticket is logged as incomplete reason but does not crash the test']),
    expected:'Test logs the incomplete ticket, marks KPI result as Incomplete or Failed, and writes the reason to Excel without crashing',
    npm:'npm run test:admin:kpi', regression:'Yes', system:'No' },
];

// ===== FORGOT PASSWORD TEST CASES (Admin Test Cases sheet) =====
const FP_CASES = [
  { id:'FP-001', desc:'Forgot Password link is visible on the ITSM login page',
    steps:steps(['Open the ITSM application sign-in page','Verify the Forgot password link is present and visible']),
    expected:'Forgot password link is visible on the login page',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-002', desc:'Clicking Forgot Password navigates to the Reset Access page',
    steps:steps(['Open the ITSM sign-in page','Click the Forgot password link','Observe the resulting page']),
    expected:'The Reset Access page is displayed with an email input field and a Send reset link button',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-003', desc:'Reset Access page shows validation error for empty email submission',
    steps:steps(['Open the ITSM sign-in page and click Forgot password','Leave the email field blank','Click the Send reset link button','Observe the page response']),
    expected:'A validation error or browser-native required-field indicator is shown; no reset link is sent',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-004', desc:'Reset Access page shows appropriate response for an unregistered email address',
    steps:steps(['Open the ITSM sign-in page and click Forgot password','Enter an email address not registered in the system (read from env or test-data, not hardcoded)','Click the Send reset link button','Observe the page response']),
    expected:'An error or informational message is shown; no reset link is delivered to the unregistered address',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-005', desc:'Submit reset request for registered email and verify success message on ITSM page',
    steps:steps(['Open the ITSM sign-in page and click Forgot password','Enter the registered email address from OUTLOOK_EMAIL env var','Click the Send reset link button','Observe the ITSM page response']),
    expected:'A success confirmation message is displayed on the ITSM page',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-006', desc:'Password reset email from Talent Talk is received in the registered Outlook inbox',
    steps:steps(['Trigger a password reset for the registered email from OUTLOOK_EMAIL env var','Open Outlook Web in a new browser tab reusing existing Microsoft session','Verify the user is signed in to Outlook without re-authentication','Search inbox for email from Talent Talk with subject containing password','Wait up to 90 seconds for email delivery']),
    expected:'A Talent Talk password reset email is present in the Outlook inbox within 90 seconds',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-007', desc:'Password reset email body contains a valid dynamic reset link',
    steps:steps(['Trigger a password reset for the registered email','Open Outlook Web and locate the Talent Talk reset email','Open the email and dynamically extract the reset link from the email body using regex or DOM','Verify the extracted link is a URL containing a token and is not hardcoded']),
    expected:'A dynamic reset link with a unique token is present in the email body; extracted at runtime not hardcoded',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-008', desc:'Following the dynamic reset link opens the password reset page with a valid token',
    steps:steps(['Trigger password reset and receive the email','Dynamically extract the reset URL from the email body without hardcoding URL or token','Navigate to the extracted reset URL in the browser','Observe the resulting page']),
    expected:'The reset page loads with a form to enter a new password; token is valid and no link expired error is shown',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-009', desc:'Full end-to-end Forgot Password flow: submit then email then dynamic link extraction then reset page validation',
    steps:steps(['Open ITSM sign-in page and click Forgot password','Enter registered email from OUTLOOK_EMAIL env var and click Send reset link','Verify success message on ITSM page then close the ITSM tab','Open Outlook Web in a new tab reusing existing Microsoft session without hardcoded credentials','Wait for Talent Talk password reset email to arrive by polling inbox up to 90 seconds','Open the email and dynamically extract the reset link from the body using regex or DOM without hardcoding','Navigate to the extracted reset URL','Verify the reset page loads with a password-entry form and a valid token and no error message']),
    expected:'All steps complete: reset request accepted, email delivered, dynamic reset link extracted, reset page accessible with valid token',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'Yes' },
  { id:'FP-010', desc:'Reset link is single-use: reusing it after password change shows link expired error',
    steps:steps(['Complete the full forgot-password flow and obtain the dynamic reset link','Use the reset link to set a new password','Navigate to the same reset URL a second time','Observe the page response']),
    expected:'Second visit to the same reset URL shows a link expired or token invalid error; reset page is not accessible again',
    npm:'npm run test:auth:forgot-password', regression:'Yes', system:'No' },
];

// ===== CHATBOT TEST CASES (AI Helpdesk Test Cases sheet) =====
const CHAT_CASES = [
  { id:'CHAT-001', desc:'Chatbot widget loads and is visible on the Admin AI Helpdesk page',
    steps:steps(['Log in as Admin and navigate to the AI Helpdesk section','Observe whether the chatbot widget and input area are visible']),
    expected:'Chatbot input and send button are visible on the Admin AI Helpdesk page',
    npm:'npm run test:admin:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Admin', query:'Hello, are you available?', behavior:'Bot responds to greeting with a welcome or availability confirmation' },
  { id:'CHAT-002', desc:'Chatbot returns contextually relevant response to a common IT issue query from Admin',
    steps:steps(['Log in as Admin and navigate to the AI Helpdesk','Type a common IT problem in the chatbot input','Submit the message and wait for the chatbot response','Evaluate whether the response is relevant to the query']),
    expected:'Chatbot response is contextually relevant to the IT issue; does not return a generic error or off-topic reply',
    npm:'npm run test:admin:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Admin', query:'My printer is not working, how do I fix it?', behavior:'Chatbot provides relevant troubleshooting steps or escalates; resolution required' },
  { id:'CHAT-003', desc:'Chatbot multi-turn conversation maintains context across messages',
    steps:steps(['Log in as Admin and open the AI Helpdesk chatbot','Send an initial query about an IT issue','Send a follow-up message that refers to the previous context','Evaluate whether the follow-up response is contextually aware of the prior exchange']),
    expected:'Chatbot follow-up response correctly references the earlier message; does not treat follow-up as a new unrelated query',
    npm:'npm run test:admin:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Admin', query:'My VPN connection drops every hour. I already tried restarting.', behavior:'Chatbot acknowledges prior context in follow-up turns; resolution required' },
  { id:'CHAT-004', desc:'Chatbot legitimately declines an out-of-scope query from Admin',
    steps:steps(['Log in as Admin and open the AI Helpdesk chatbot','Submit a query outside the IT helpdesk scope','Observe the chatbot response']),
    expected:'Chatbot explicitly declines the out-of-scope query with a polite relevant response',
    npm:'npm run test:admin:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Admin', query:'What is the best cryptocurrency to invest in right now?', behavior:'Decline allowed - bot should refuse this out-of-scope query' },
  { id:'CHAT-005', desc:'Chatbot widget loads and is visible on the Employee AI Helpdesk page',
    steps:steps(['Log in as Employee and navigate to the AI Helpdesk section','Observe whether the chatbot widget and input area are visible']),
    expected:'Chatbot input and send button are visible on the Employee AI Helpdesk page',
    npm:'npm run test:employee:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Employee', query:'Hello, are you available?', behavior:'Bot responds to greeting with a welcome or availability confirmation' },
  { id:'CHAT-006', desc:'Employee chatbot resolves a common IT issue query autonomously',
    steps:steps(['Log in as Employee and navigate to the AI Helpdesk','Submit a common IT support query','Allow up to 6 conversation turns','Evaluate whether the chatbot reached a satisfactory resolution']),
    expected:'Chatbot reaches a satisfactory resolution within 6 turns without requiring human escalation',
    npm:'npm run test:employee:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Employee', query:'I cannot access my email account, it keeps saying incorrect password.', behavior:'Chatbot provides resolution steps; resolution required' },
  { id:'CHAT-007', desc:'Employee chatbot declines a query outside IT helpdesk scope',
    steps:steps(['Log in as Employee and open the AI Helpdesk chatbot','Submit a query unrelated to IT support','Observe the chatbot response']),
    expected:'Chatbot politely declines the non-IT query without attempting to answer it',
    npm:'npm run test:employee:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Employee', query:'Can you write a poem for me?', behavior:'Decline allowed - bot should refuse this out-of-scope query' },
  { id:'CHAT-008', desc:'IT Staff chatbot resolves a technical operational issue',
    steps:steps(['Log in as IT Staff and navigate to the AI Helpdesk section','Submit a technical IT operational query','Allow up to 6 turns','Evaluate whether the chatbot resolved the issue']),
    expected:'Chatbot provides relevant technical guidance and reaches a satisfactory resolution within 6 turns',
    npm:'npm run test:itstaff:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'IT Staff', query:'A server in rack B3 is showing high CPU load alerts. What should I check first?', behavior:'Chatbot provides technical resolution steps; resolution required' },
  { id:'CHAT-009', desc:'IT Staff chatbot declines a non-IT operational query',
    steps:steps(['Log in as IT Staff and open the AI Helpdesk chatbot','Submit a query clearly outside the IT operations scope','Observe the chatbot response']),
    expected:'Chatbot declines the query with an appropriate response; does not attempt to answer irrelevant questions',
    npm:'npm run test:itstaff:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'IT Staff', query:'What is the weather forecast for tomorrow?', behavior:'Decline allowed - bot should refuse this out-of-scope query' },
  { id:'CHAT-010', desc:'Chatbot does not repeat the same question in a multi-turn conversation',
    steps:steps(['Log in as Admin and open the AI Helpdesk chatbot','Submit an IT query that requires clarification','Answer the chatbots first clarifying question','Continue the conversation for at least 4 turns','Observe whether the chatbot ever asks the same question twice']),
    expected:'Chatbot does not ask the same question more than once; each turn advances the resolution',
    npm:'npm run test:admin:ai-helpdesk', regression:'Yes', system:'Yes',
    dashboard:'Admin', query:'My laptop screen is flickering. It started after the latest Windows update.', behavior:'Chatbot must not repeat questions; resolution required' },
];

// ===== RTC IT STAFF TEST CASES (IT Staff Test Cases sheet) =====
const RTC_ITS_CASES = [
  { id:'RTC-ITS-001', desc:'IT Staff can open a ticket and access the real-time chat interface',
    steps:steps(['Log in as IT Staff using Chrome browser','Navigate to the Ticket Queue','Open the first available ticket','Scroll to the ticket chat or comment section','Verify the chat input and send button are visible']),
    expected:'Ticket chat interface is visible for IT Staff with a message input field and send button',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-002', desc:'IT Staff message is delivered to Employee in real time without page refresh',
    steps:steps(['Log in as IT Staff on Chrome and Employee on Edge simultaneously on the same ticket','IT Staff types and sends a message in the ticket chat','Employee browser polls for the new message without refreshing the page','Measure the delivery latency']),
    expected:'Employee receives IT Staff message within a reasonable latency period without manually refreshing the page',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-003', desc:'IT Staff receives Employee response in real time',
    steps:steps(['Log in as IT Staff on Chrome and Employee on Edge on the same ticket','Employee sends a response message in the ticket chat','IT Staff browser polls for the new message without page refresh','Verify message content and delivery']),
    expected:'IT Staff receives the Employee response without page refresh; message content is accurate',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-004', desc:'Multi-turn real-time conversation completes between IT Staff and Employee up to 8 exchanges',
    steps:steps(['Launch Chrome for IT Staff and Edge for Employee simultaneously','Both users navigate to the same ticket','Conduct a multi-turn conversation using LLM or heuristic message generation (max 8 turns)','Verify each message is delivered in real time in both directions','Verify conversation terminates when issue is resolved or max turns reached']),
    expected:'All exchanges complete successfully; messages delivered in real time both directions; conversation terminates cleanly',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-005', desc:'IT Staff and Employee are on the same ticket (ticket association validation)',
    steps:steps(['IT Staff opens the first ticket in the queue and records the Ticket ID','Employee navigates to My Tickets and opens the matching ticket by Ticket ID','If exact ticket is not found Employee opens the most recent ticket','Compare Ticket IDs visible in both browsers']),
    expected:'Both IT Staff and Employee are viewing the same ticket with identical Ticket IDs or a clear warning is logged if they diverged',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-006', desc:'Real-time chat messages are delivered in the correct chronological order',
    steps:steps(['Conduct a multi-turn real-time chat session between IT Staff and Employee','After the session compare the message order on both browsers','Verify messages appear in the same order on both sides']),
    expected:'Message order is identical on both IT Staff and Employee views; no messages appear out of sequence',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-007', desc:'No duplicate messages appear in the real-time chat',
    steps:steps(['IT Staff sends multiple messages during a real-time chat session','After each send verify on IT Staff view that no message appears twice','Similarly verify on Employee view']),
    expected:'No duplicate messages are visible in the chat on either browser side',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-ITS-008', desc:'Real-time chat test report is generated with latencies, exchange log, and final result',
    steps:steps(['Run the real-time chat test to completion','Observe the console and test report output','Verify the report includes browser sessions, ticket info, message counts, delivery latencies, LLM validation flags, and final PASSED or FAILED result']),
    expected:'A structured test report is printed to console with all required sections; Final Result shows PASSED or FAILED',
    npm:'npm run test:itstaff:rtc', regression:'Yes', system:'Yes' },
];

// ===== RTC EMPLOYEE TEST CASES (Employee Test Cases sheet) =====
const RTC_EMP_CASES = [
  { id:'RTC-EMP-001', desc:'Employee can access the real-time ticket chat interface from My Tickets',
    steps:steps(['Log in as Employee','Navigate to My Tickets','Open an existing ticket','Scroll to the ticket chat or comment section','Verify chat input and send button are visible']),
    expected:'Employee can see the ticket chat interface with a message input field and send button',
    npm:'npm run test:employee:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-EMP-002', desc:'Employee message is delivered to IT Staff in real time without page refresh',
    steps:steps(['Log in as Employee on Edge and IT Staff on Chrome simultaneously on the same ticket','Employee types and sends a message in the ticket chat','IT Staff browser polls for the new message without refreshing the page','Measure the delivery latency']),
    expected:'IT Staff receives Employee message within a reasonable latency period without manually refreshing the page',
    npm:'npm run test:employee:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-EMP-003', desc:'Employee receives IT Staff message in real time',
    steps:steps(['Log in as Employee on Edge and IT Staff on Chrome on the same ticket','IT Staff sends a message in the ticket chat','Employee browser receives the message without page refresh','Verify message content accuracy on Employee screen']),
    expected:'Employee receives IT Staff message in real time; message content is accurate',
    npm:'npm run test:employee:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-EMP-004', desc:'Employee participates in a multi-turn LLM-driven real-time conversation',
    steps:steps(['Launch Employee on Edge and IT Staff on Chrome simultaneously on the same ticket','Conduct a multi-turn conversation (max 8 exchanges) using dynamic message generation','Employee responds dynamically to each IT Staff message','Verify all Employee messages are delivered to IT Staff in real time']),
    expected:'Employee side of the multi-turn conversation works correctly; all messages sent and received in real time',
    npm:'npm run test:employee:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-EMP-005', desc:'Employee message content integrity: sent text matches received text on IT Staff side',
    steps:steps(['Employee sends a specific message in the ticket chat','Record the exact text sent','Verify the text received on IT Staff browser matches exactly']),
    expected:'Message content is not truncated, garbled, or modified during real-time delivery',
    npm:'npm run test:employee:rtc', regression:'Yes', system:'Yes' },
  { id:'RTC-EMP-006', desc:'Real-time conversation resolves the ticket issue within max turns',
    steps:steps(['Employee and IT Staff conduct a multi-turn real-time conversation','Use LLM or heuristic analysis to detect when issue is sufficiently resolved','Verify conversation terminates early when resolution is detected before max 8 turns']),
    expected:'Conversation terminates once issue is resolved or max turns reached; at least 1 exchange must have completed',
    npm:'npm run test:employee:rtc', regression:'Yes', system:'Yes' },
];

// ===== WRITER =====
async function run() {
  if (!fs.existsSync(MASTER)) {
    console.error('ERROR: Master Excel not found at:', MASTER);
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MASTER);

  function getExistingIds(ws) {
    const ids = new Set();
    ws.eachRow({includeEmpty:false}, (row) => {
      const id = (row.getCell(1).value || '').toString().trim();
      if (id) ids.add(id);
    });
    return ids;
  }

  function appendRow(ws, cols) {
    const r = ws.addRow(cols);
    r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    r.getCell(4).alignment = { wrapText: true, vertical: 'top' };
  }

  // Admin sheet
  const adminWs = wb.getWorksheet('Admin Test Cases');
  const adminIds = getExistingIds(adminWs);
  let kpiCount = 0, fpCount = 0;
  for (const c of KPI_CASES) {
    if (adminIds.has(c.id)) { console.log('Skip:', c.id); continue; }
    appendRow(adminWs, [c.id, c.desc, c.steps, c.expected, '', '', 'NOT EXECUTED', c.npm, c.regression, c.system]);
    kpiCount++;
  }
  for (const c of FP_CASES) {
    if (adminIds.has(c.id)) { console.log('Skip:', c.id); continue; }
    appendRow(adminWs, [c.id, c.desc, c.steps, c.expected, '', '', 'NOT EXECUTED', c.npm, c.regression, c.system]);
    fpCount++;
  }
  console.log(`Admin Test Cases: +${kpiCount} KPI, +${fpCount} FP`);

  // AI Helpdesk sheet
  const aiWs = wb.getWorksheet('AI Helpdesk Test Cases');
  const aiIds = getExistingIds(aiWs);
  let chatCount = 0;
  for (const c of CHAT_CASES) {
    if (aiIds.has(c.id)) { console.log('Skip:', c.id); continue; }
    appendRow(aiWs, [c.id, c.desc, c.steps, c.expected, '', '', 'NOT EXECUTED', c.npm, c.regression, c.system, c.dashboard, c.query, c.behavior]);
    chatCount++;
  }
  console.log(`AI Helpdesk Test Cases: +${chatCount} CHAT`);

  // IT Staff sheet
  const itWs = wb.getWorksheet('IT Staff Test Cases');
  const itIds = getExistingIds(itWs);
  let rtcIts = 0;
  for (const c of RTC_ITS_CASES) {
    if (itIds.has(c.id)) { console.log('Skip:', c.id); continue; }
    appendRow(itWs, [c.id, c.desc, c.steps, c.expected, '', '', 'NOT EXECUTED', c.npm, c.regression, c.system]);
    rtcIts++;
  }
  console.log(`IT Staff Test Cases: +${rtcIts} RTC`);

  // Employee sheet
  const empWs = wb.getWorksheet('Employee Test Cases');
  const empIds = getExistingIds(empWs);
  let rtcEmp = 0;
  for (const c of RTC_EMP_CASES) {
    if (empIds.has(c.id)) { console.log('Skip:', c.id); continue; }
    appendRow(empWs, [c.id, c.desc, c.steps, c.expected, '', '', 'NOT EXECUTED', c.npm, c.regression, c.system]);
    rtcEmp++;
  }
  console.log(`Employee Test Cases: +${rtcEmp} RTC`);

  await wb.xlsx.writeFile(MASTER);
  console.log('\nITSM_2_0_Test_Cases.xlsx updated. Total new rows:', kpiCount + fpCount + chatCount + rtcIts + rtcEmp);
}

run().catch((err) => { console.error('FATAL:', err.message); process.exit(1); });
