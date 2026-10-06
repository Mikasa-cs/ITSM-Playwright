// ---------------------------------------------------------------------------
// reporter/test-id-map.js
//
// Single source of truth: Playwright spec file  ->  ITSM_2_0_Test_Cases.xlsx rows.
//
// Each entry defines:
//   file         â€“ spec file path (relative to project root, forward slashes)
//   titleIncludes â€“ optional: only match tests whose title includes this string
//   sheet        â€“ which Excel sheet to update
//   ids          â€“ exact Test IDs to update (optional, for single-row mappings)
//   prefixes     â€“ ID prefixes to match dynamically (e.g. 'TQ' -> TQ-001, TQ-002...)
//   npmCommand   â€“ the npm run command that executes this spec
//   category     â€“ 'Smoke' | 'System' | 'Regression'
//
// Prefixes are resolved at runtime against column A of each sheet, so adding
// new rows to Excel with the matching prefix automatically includes them.
//
// NOTE: Both old-style command names (used in Excel NPM Command column for
// existing ~800 rows) and new concept-based names are covered so that BOTH
// the sequential runner (reads commands from Excel) and the parallel runner
// (uses concept-based names) work correctly.
// ---------------------------------------------------------------------------

module.exports = [
  // =========================================================================
  // LOGIN MATRIX -- ITSM-01 / ITSM-02 / ITSM-03 (4 cases each = 12 total)
  // Each sub-row is mapped individually so the reporter writes ONLY to the
  // exact row that was executed - never cross-contaminating roles.
  // =========================================================================

  // ITSM-01 Admin sub-rows
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-1', sheet: 'Admin Test Cases', ids: ['ITSM-01-1'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-2', sheet: 'Admin Test Cases', ids: ['ITSM-01-2'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-3', sheet: 'Admin Test Cases', ids: ['ITSM-01-3'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-01-4', sheet: 'Admin Test Cases', ids: ['ITSM-01-4'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },

  // ITSM-02 IT Staff sub-rows
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-1', sheet: 'Admin Test Cases', ids: ['ITSM-02-1'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-2', sheet: 'Admin Test Cases', ids: ['ITSM-02-2'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-3', sheet: 'Admin Test Cases', ids: ['ITSM-02-3'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-02-4', sheet: 'Admin Test Cases', ids: ['ITSM-02-4'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },

  // ITSM-03 Employee sub-rows
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-1', sheet: 'Admin Test Cases', ids: ['ITSM-03-1'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-2', sheet: 'Admin Test Cases', ids: ['ITSM-03-2'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-3', sheet: 'Admin Test Cases', ids: ['ITSM-03-3'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },
  { file: 'tests/smoke/login-matrix.spec.js', titleIncludes: 'ITSM-03-4', sheet: 'Admin Test Cases', ids: ['ITSM-03-4'], npmCommand: 'npm run test:login:matrix', category: 'Smoke' },


  // =========================================================================
  // ADMIN â€“ Smoke
  // =========================================================================
  {
    file: 'tests/smoke/smoke.spec.js',
    titleIncludes: 'Admin user can authenticate',
    sheet: 'Admin Test Cases',
    ids: ['ITSM-01'],
    npmCommand: 'npm run test:smoke:admin',
    category: 'Smoke',
  },
  {
    file: 'tests/smoke/smoke.spec.js',
    titleIncludes: 'IT Staff user can authenticate',
    sheet: 'Admin Test Cases',
    ids: ['ITSM-02'],
    npmCommand: 'npm run test:smoke:itstaff',
    category: 'Smoke',
  },
  {
    file: 'tests/smoke/smoke.spec.js',
    titleIncludes: 'Employee user can authenticate',
    sheet: 'Admin Test Cases',
    ids: ['ITSM-03'],
    npmCommand: 'npm run test:smoke:employee',
    category: 'Smoke',
  },

  // =========================================================================
  // ADMIN â€“ ITSM / Dashboard
  // =========================================================================
  {
    file: 'tests/admin/dashboard.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['ITSM'],
    npmCommand: 'npm run test:admin:itsm',
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ TQ (Ticket Queue)
  // Covers both old "test:admin:tickets" (used in Excel) and new "test:admin:tq"
  // =========================================================================
  {
    file: 'tests/admin/ticket-queue.spec.js',
    sheet: 'Admin Test Cases',
    ids: ['ITSM-04'],
    prefixes: ['TQ'],
    npmCommand: 'npm run test:admin:tickets',   // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/admin/ticket-queue.spec.js',
    sheet: 'Admin Test Cases',
    ids: ['ITSM-04'],
    prefixes: ['TQ'],
    npmCommand: 'npm run test:admin:tq',        // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ AM (Alert Management)
  // =========================================================================
  {
    file: 'tests/admin/alert-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['AM'],
    npmCommand: 'npm run test:admin:alerts',    // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/admin/alert-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['AM'],
    npmCommand: 'npm run test:admin:am',        // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ LM (Leave Management)
  // =========================================================================
  {
    file: 'tests/admin/leave-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['LM'],
    npmCommand: 'npm run test:admin:leaves',    // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/admin/leave-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['LM'],
    npmCommand: 'npm run test:admin:lm',        // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ UM (User Management)
  // =========================================================================
  {
    file: 'tests/admin/user-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['UM'],
    npmCommand: 'npm run test:admin:users',     // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/admin/user-management.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['UM'],
    npmCommand: 'npm run test:admin:um',        // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ ISM (Settings / IT Staff Management)
  // =========================================================================
  {
    file: 'tests/admin/settings.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['ISM'],
    npmCommand: 'npm run test:admin:settings',  // backward compat
    category: 'System',
  },
  {
    file: 'tests/admin/settings.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['ISM'],
    npmCommand: 'npm run test:admin:ism',       // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ KPI (Admin KPI Validation)
  // =========================================================================
  {
    file: 'tests/admin/kpi-validation.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['KPI'],
    npmCommand: 'npm run test:admin:kpi',
    category: 'System',
  },

  // =========================================================================
  // ADMIN â€“ FP (Forgot Password)
  // =========================================================================
  {
    file: 'tests/auth/forgot-password.spec.js',
    sheet: 'Admin Test Cases',
    prefixes: ['FP'],
    npmCommand: 'npm run test:auth:forgot-password',
    category: 'System',
  },

  // =========================================================================
  // AI HELPDESK / CHATBOT (CHAT)
  // Admin AI Helpdesk: covers AIHD-ADM-* and CHAT-* rows with dashboard=Admin
  // =========================================================================
  {
    file: 'tests/admin/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['AIHD-ADM', 'CHAT'],
    npmCommand: 'npm run test:admin:ai-helpdesk',
    category: 'System',
  },
  // Employee AI Helpdesk: covers AIHD-EMP-* and CHAT-* rows with dashboard=Employee
  {
    file: 'tests/employee/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['AIHD-EMP', 'CHAT'],
    npmCommand: 'npm run test:employee:ai-helpdesk',
    category: 'System',
  },
  // IT Staff AI Helpdesk: covers AIHD-ITS-* and CHAT-* rows with dashboard=IT Staff
  {
    file: 'tests/it-staff/ai-helpdesk.spec.js',
    sheet: 'AI Helpdesk Test Cases',
    prefixes: ['AIHD-ITS', 'CHAT'],
    npmCommand: 'npm run test:itstaff:ai-helpdesk',
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE â€“ ED (Employee Dashboard)
  // =========================================================================
  {
    file: 'tests/employee/dashboard.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['ED'],
    npmCommand: 'npm run test:employee:dashboard',  // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/employee/dashboard.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['ED'],
    npmCommand: 'npm run test:employee:ed',         // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE â€“ EMT (Employee My Tickets)
  // =========================================================================
  {
    file: 'tests/employee/my-tickets.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['EMT'],
    npmCommand: 'npm run test:employee:tickets',    // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/employee/my-tickets.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['EMT'],
    npmCommand: 'npm run test:employee:emt',        // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // EMPLOYEE â€“ RTC (Real-Time Chat, Employee perspective)
  // =========================================================================
  {
    file: 'tests/realtime/ticket-realtime-chat.spec.js',
    sheet: 'Employee Test Cases',
    prefixes: ['RTC-EMP'],
    npmCommand: 'npm run test:employee:rtc',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF â€“ ITD (IT Staff Dashboard)
  // =========================================================================
  {
    file: 'tests/it-staff/dashboard.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['ITD'],
    npmCommand: 'npm run test:itstaff:dashboard',   // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/it-staff/dashboard.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['ITD'],
    npmCommand: 'npm run test:itstaff:itd',         // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // IT STAFF â€“ ITS-TQ (IT Staff Ticket Queue)
  // =========================================================================
  {
    file: 'tests/it-staff/ticket-queue.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['ITS-TQ'],
    npmCommand: 'npm run test:itstaff:tickets',     // matches existing Excel rows
    category: 'System',
  },
  {
    file: 'tests/it-staff/ticket-queue.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['ITS-TQ'],
    npmCommand: 'npm run test:itstaff:itstq',       // new concept-based alias
    category: 'System',
  },

  // =========================================================================
  // IT STAFF â€“ AC / LR (mapped to AI helpdesk spec until dedicated specs exist)
  // =========================================================================
  {
    file: 'tests/it-staff/ai-helpdesk.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['AC'],
    npmCommand: 'npm run test:itstaff:ac',
    category: 'System',
  },
  {
    file: 'tests/it-staff/ai-helpdesk.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['LR'],
    npmCommand: 'npm run test:itstaff:lr',
    category: 'System',
  },

  // =========================================================================
  // IT STAFF â€“ RTC (Real-Time Chat, IT Staff perspective)
  // =========================================================================
  {
    file: 'tests/realtime/ticket-realtime-chat.spec.js',
    sheet: 'IT Staff Test Cases',
    prefixes: ['RTC-ITS'],
    npmCommand: 'npm run test:itstaff:rtc',
    category: 'System',
  },
];

