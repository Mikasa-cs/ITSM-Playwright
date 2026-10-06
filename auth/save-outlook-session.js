/**
 * save-outlook-session.js
 * -----------------------------------------------------------------------
 * ONE-TIME SETUP SCRIPT — Run this ONCE before running the forgot-password test.
 *
 * Usage:
 *   node auth/save-outlook-session.js
 *
 * What it does:
 *   1. Opens a headed Chromium browser and navigates to Outlook Web
 *   2. You manually sign in to shivi.singh@vlinkinfo.com in that browser
 *   3. Once your inbox is visible, press ENTER in this terminal
 *   4. The session (cookies + localStorage) is saved to auth/outlook-session.json
 *   5. The browser closes — all future test runs load this saved session
 *
 * You only need to re-run this script if your session expires (usually 90 days).
 * -----------------------------------------------------------------------
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const readline = require('readline');

const SESSION_FILE = path.resolve(__dirname, 'outlook-session.json');
const OUTLOOK_URL = 'https://outlook.office365.com/mail/';

async function main() {
  console.log('');
  console.log('=============================================================');
  console.log('  Outlook Web Session Setup');
  console.log('=============================================================');
  console.log('');
  console.log('1. A browser will open and navigate to Outlook Web.');
  console.log('2. Please SIGN IN to shivi.singh@vlinkinfo.com in that browser.');
  console.log('3. Once your INBOX is fully visible and loaded...');
  console.log('4. Come back to this terminal and press ENTER.');
  console.log('');
  console.log('Your session will be saved to: auth/outlook-session.json');
  console.log('=============================================================');
  console.log('');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  await page.goto(OUTLOOK_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Browser opened. Please sign in to Outlook Web now...');
  console.log('');

  // Wait for user to manually sign in
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question('>>> Press ENTER once your Outlook inbox is visible and fully loaded: ', () => {
      rl.close();
      resolve();
    });
  });

  console.log('');
  console.log('Saving session...');

  // Save the full session state (cookies + localStorage)
  await context.storageState({ path: SESSION_FILE });
  await browser.close();

  console.log('');
  console.log('SUCCESS! Session saved to: auth/outlook-session.json');
  console.log('You can now run:  npm run test:auth:forgot-password');
  console.log('');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
