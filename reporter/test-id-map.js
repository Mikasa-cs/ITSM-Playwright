// ---------------------------------------------------------------------------
// reporter/test-id-map.js
//
// Single source of truth: Playwright spec file  ->  ITSM_2_0_Test_Cases.xlsx rows.
//
// Each entry defines:
//   file          – spec file path (relative to project root, forward slashes)
//   titleIncludes – optional: only match tests whose title includes this string
//   sheet         – which Excel sheet to update
//   ids           – exact Test IDs to update (optional, for single-row mappings)
//   prefixes      – ID prefixes to match dynamically (e.g. 'TQ' -> TQ-001, TQ-002...)
//   npmCommand    – canonical npm run command that executes this spec
//   category      – 'Smoke' | 'System' | 'Regression'
// ---------------------------------------------------------------------------

module.exports = [
  // =========================================================================
  // LOGIN MATRIX -- ITSM-01 / ITSM-02 / ITSM-03 (4 cases each = 12 total)
  // Canonical command: test:admin:itsm
  // =========================================================================

  // ITSM-01 Admin sub-rows
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-1', sheet: 'Admin Test Cases', ids: ['ITSM-01-1'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-2', sheet: 'Admin Test Cases', ids: ['ITSM-01-2'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-3', sheet: 'Admin Test Cases', ids: ['ITSM-01-3'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-4', sheet: 'Admin Test Cases', ids: ['ITSM-01-4'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },

  // ITSM-02 IT Staff sub-rows
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-1', sheet: 'Admin Test Cases', ids: ['ITSM-02-1'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-2', sheet: 'Admin Test Cases', ids: ['ITSM-02-2'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-3', sheet: 'Admin Test Cases', ids: ['ITSM-02-3'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-4', sheet: 'Admin Test Cases', ids: ['ITSM-02-4'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },

  // ITSM-03 Employee sub-rows
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-1', sheet: 'Admin Test Cases', ids: ['ITSM-03-1'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-2', sheet: 'Admin Test Cases', ids: ['ITSM-03-2'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-3', sheet: 'Admin Test Cases', ids: ['ITSM-03-3'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-4', sheet: 'Admin Test Cases', ids: ['ITSM-03-4'], npmCommand: 'npm run test:admin:itsm', category: 'Smoke' },

  // =========================================================================
  // ADMIN – TQ (Ticket Queue)
  // =========================================================================
  {
    file: 'tests/admin/ticket-queue.spec.js',
    sheet: 'Admin Test Cases',
    ids: ['ITSM-04'],
    prefixes: ['TQ'],
    npmCommand: 'npm run test:admin:tq',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – KB (Knowledge Base)
  // =========================================================================
  {
    file: 'tests/admin/knowledge-base.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['KB'],
    npmCommand: 'npm run test:admin:kb',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – LM (Leave Management)
  // =========================================================================
  {
    file: 'tests/admin/leave-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['LM'],
    npmCommand: 'npm run test:admin:lm',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – AM (Alert Management)
  // =========================================================================
  {
    file: 'tests/admin/alert-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['AM'],
    npmCommand: 'npm run test:admin:am',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – UM (User Management)
  // =========================================================================
  {
    file: 'tests/admin/user-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['UM'],
    npmCommand: 'npm run test:admin:um',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – ISM (IT Staff Management / Settings)
  // =========================================================================
  {
    file: 'tests/admin/settings.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['ISM'],
    npmCommand: 'npm run test:admin:ism',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – KPI (Admin KPI Validation)
  // =========================================================================
  {
    file: 'tests/admin/kpi-validation.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['KPI'],
    npmCommand: 'npm run test:admin:kpi',
    category: 'System',
  },

  // =========================================================================
  // AUTH – FP (Forgot Password)
  // =========================================================================
  {
    file: 'tests/auth/forgot-password.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['FP'],
    npmCommand: 'npm run test:auth:fp',
    category: 'System',
  },

  // =========================================================================
  // ADMIN – AI Helpdesk (Admin Role)
  // =========================================================================
  {
    file: 'tests/admin/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['AIHD-ADM'],
    npmCommand: 'npm run test:admin:ai-helpdesk',
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE – AI Helpdesk (Employee Role)
  // =========================================================================
  {
    file: 'tests/employee/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['AIHD-EMP'],
    npmCommand: 'npm run test:employee:ai-helpdesk',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF – AI Helpdesk (IT Staff Role)
  // =========================================================================
  {
    file: 'tests/it-staff/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['AIHD-ITS'],
    npmCommand: 'npm run test:itstaff:ai-helpdesk',
    category: 'System',
  },

  // =========================================================================
  // AI HELPDESK – CHATBOT (CHAT-001 through CHAT-010)
  // =========================================================================
  {
    file: 'tests/admin/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['CHAT'],
    npmCommand: 'npm run test:ai-helpdesk:chat',
    category: 'System',
  },
  {
    file: 'tests/employee/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['CHAT'],
    npmCommand: 'npm run test:ai-helpdesk:chat',
    category: 'System',
  },
  {
    file: 'tests/it-staff/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['CHAT'],
    npmCommand: 'npm run test:ai-helpdesk:chat',
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE – ED (Employee Dashboard)
  // =========================================================================
  {
    file: 'tests/employee/dashboard.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['ED'],
    npmCommand: 'npm run test:employee:ed',
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE – EMT (Employee My Tickets)
  // =========================================================================
  {
    file: 'tests/employee/my-tickets.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['EMT'],
    npmCommand: 'npm run test:employee:emt',
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE – RTC (Real-Time Chat, Employee perspective)
  // =========================================================================
  {
    file: 'tests/realtime/ticket-realtime-chat.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['RTC-EMP'],
    npmCommand: 'npm run test:employee:rtc',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF – ITD (IT Staff Dashboard)
  // =========================================================================
  {
    file: 'tests/it-staff/dashboard.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['ITD'],
    npmCommand: 'npm run test:itstaff:itd',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF – ITS-TQ (IT Staff Ticket Queue)
  // =========================================================================
  {
    file: 'tests/it-staff/ticket-queue.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['ITS-TQ'],
    npmCommand: 'npm run test:itstaff:itstq',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF – AC (Alert Center)
  // =========================================================================
  {
    file: 'tests/it-staff/alert-center.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['AC'],
    npmCommand: 'npm run test:itstaff:ac',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF – LR (Leave Request / Calendar)
  // Covers row 282 (Test ID 's') + rows 283-341 (LR-002 .. LR-060)
  // =========================================================================
  {
    file: 'tests/it-staff/leave-request.spec.js',
    sheet: 'IT Staff Test Cases',
    ids: ['s'],
    prefixes: ['LR'],
    npmCommand: 'npm run test:itstaff:lr',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF – RTC (Real-Time Chat, IT Staff perspective)
  // =========================================================================
  {
    file: 'tests/realtime/ticket-realtime-chat.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['RTC-ITS'],
    npmCommand: 'npm run test:itstaff:rtc',
    category: 'System',
  },
];
