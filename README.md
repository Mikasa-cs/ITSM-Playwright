# Enterprise ITSM Helpdesk Copilot - Playwright Test Framework

Automated test suite using [Playwright](https://playwright.dev/) implementing the **Page Object Model (POM)** and custom role fixtures for the **Enterprise ITSM Helpdesk Copilot** web portal.

Portal URL: `https://ithelpdesk.vlinklabs.com/`

> 📊 This project is live-connected to `ITSM_2_0_Test_Cases.xlsx` — every `npm run test...`
> command updates that workbook's Result/Actual Result/Execution columns automatically as tests
> run. See **[EXCEL_SYNC.md](./EXCEL_SYNC.md)** for how it works and how to extend it.

---

## 📁 Project Architecture

```
itsm-playwright-tests/
│
├── tests/                           # Test specs organized by user role and scope
│   ├── employee/                    # Employee portal tests
│   │   ├── dashboard.spec.js        # Self-service dashboard metrics and welcome view
│   │   ├── my-tickets.spec.js       # Viewing tickets and commenting
│   │   └── ai-helpdesk.spec.js      # Conversational Wi-Fi troubleshooting flow
│   │
│   ├── it-staff/                    # IT Staff operational tests
│   │   ├── dashboard.spec.js        # Staff dashboard and ticket counts
│   │   ├── ticket-queue.spec.js     # Managing queues and triaging tickets
│   │   └── ai-helpdesk.spec.js      # Staff assistant interactions
│   │
│   ├── admin/                       # System Administration tests
│   │   ├── dashboard.spec.js        # System metrics & system alert broadcasting
│   │   ├── ticket-queue.spec.js     # Ticket creation, employee assignment, resolution
│   │   ├── leave-management.spec.js # Leave management panels
│   │   ├── user-management.spec.js  # User directory and permissions
│   │   └── settings.spec.js         # Configuration settings
│   │
│   ├── e2e/                         # Cross-role end-to-end user journeys
│   │   └── ticket-lifecycle.spec.js # Alert -> Ticket Creation -> Comment -> Resolve
│   │
│   └── smoke/                       # Quick health checks
│       └── smoke.spec.js            # Role authentication checks (Admin, Staff, Employee)
│
├── pages/                           # Page Object Models (encapsulating UI locators & actions)
│   ├── LoginPage.js                 # Authentication, form inputs, error handling
│   ├── AdminDashboardPage.js        # Admin navigation & system alerts
│   ├── ITStaffDashboardPage.js      # IT staff view & queue links
│   ├── EmployeeDashboardPage.js     # Self-service landing & quick links
│   ├── TicketQueuePage.js           # Modal forms, ticket list, resolution dialog, comments
│   ├── MyTicketsPage.js             # Employee ticket view
│   └── AIHelpdeskPage.js            # Chat input, sending messages, suggestion buttons
│
├── fixtures/                        # Custom Playwright fixtures with pre-authenticated sessions
│   ├── admin.fixture.js             # Admin page & POM instances
│   ├── itstaff.fixture.js           # IT Staff page & POM instances
│   └── employee.fixture.js          # Employee page & POM instances
│
├── auth/                            # Directory for auth state storage (if needed)
│
├── test-data/                       # Test data payloads
│   ├── ticket-data.json             # Mock tickets, known employees, alerts, comments
│   └── chatbot-scenarios.json       # Chatbot dialogue test trees
│
├── utils/                           # Shared utility helpers
│   ├── auth.js                      # Cold-start retry, native select helper, wait methods
│   └── ai-evaluator.js              # Chat messaging helper & action buttons
│
├── playwright.config.js             # Playwright runner configuration (dotenv, retries, browsers)
├── package.json                     # NPM dependencies & scripts
├── .env                             # Environment variables & secrets
├── .env.example                     # Environment template
└── README.md                        # Documentation
```

---



## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (already done by default):
```bash
cp .env.example .env
```

---

## 🧪 Running Tests

## 🧪 Testing Strategies: Type 1 vs Type 2

For each of the three dashboards (**Admin**, **IT Staff**, and **Employee**), the framework supports two distinct testing types:

1. **Type 1 (All-in-One Continuous Test)**: Tests the **whole dashboard in one go** in a single browser session with **no login and logout between functionalities**.
2. **Type 2 (Per-Functionality Independent Tests)**: Dedicated spec files for each distinct feature, each runnable independently via its own separate npm command.

---

### 👑 Admin Dashboard Commands (`admin@enterprise.com` / `Password@123`)

| Type | Functionality / Scope | Command | Headed Mode |
|---|---|---|---|
| **Type 1** | **Whole Dashboard in One Go** | `npm run test:admin:type1` | `npm run test:admin:type1:headed` |
| **Type 2** | All Type 2 Admin Specs | `npm run test:admin:type2` | - |
| **Type 2** | Dashboard Overview & Metrics | `npm run test:admin:dashboard` | - |
| **Type 2** | Alert Management (Broadcast Alert) | `npm run test:admin:alerts` | - |
| **Type 2** | Ticket Queue (Create, Resolve, Comment) | `npm run test:admin:tickets` | - |
| **Type 2** | AI Helpdesk Copilot Chat | `npm run test:admin:ai-helpdesk` | - |
| **Type 2** | Leave Management Portal | `npm run test:admin:leaves` | - |
| **Type 2** | User Management Directory | `npm run test:admin:users` | - |
| **Type 2** | System Settings | `npm run test:admin:settings` | - |

---

### 🛠️ IT Staff Dashboard Commands (`agent@enterprise.com` / `Password@123`)

| Type | Functionality / Scope | Command | Headed Mode |
|---|---|---|---|
| **Type 1** | **Whole Dashboard in One Go** | `npm run test:itstaff:type1` | `npm run test:itstaff:type1:headed` |
| **Type 2** | All Type 2 IT Staff Specs | `npm run test:itstaff:type2` | - |
| **Type 2** | Dashboard & Assigned Metrics | `npm run test:itstaff:dashboard` | - |
| **Type 2** | Ticket Queue (Triage & Comment) | `npm run test:itstaff:tickets` | - |
| **Type 2** | AI Helpdesk Copilot Assistant | `npm run test:itstaff:ai-helpdesk` | - |

---

### 👤 Employee Dashboard Commands (`employee@enterprise.com` / `Password@123`)

| Type | Functionality / Scope | Command | Headed Mode |
|---|---|---|---|
| **Type 1** | **Whole Dashboard in One Go** | `npm run test:employee:type1` | `npm run test:employee:type1:headed` |
| **Type 2** | All Type 2 Employee Specs | `npm run test:employee:type2` | - |
| **Type 2** | Dashboard Landing & Welcome View | `npm run test:employee:dashboard` | - |
| **Type 2** | My Tickets (Status & Reply) | `npm run test:employee:tickets` | - |
| **Type 2** | AI Helpdesk (Guided Troubleshooting) | `npm run test:employee:ai-helpdesk` | - |

---

### 🌐 Browser & Generic Commands

| Browser / Suite | Headless Mode | Headed Mode |
|---|---|---|
| **Google Chrome** | `npm run test:chrome` | `npm run test:chrome:headed` |
| **Microsoft Edge** | `npm run test:edge` | `npm run test:edge:headed` |
| **Chromium** | `npm run test:chromium` | `npm run test:chromium:headed` |
| **Firefox** | `npm run test:firefox` | `npm run test:firefox:headed` |
| **WebKit (Safari)** | `npm run test:webkit` | `npm run test:webkit:headed` |
| **Smoke Tests** (Role Logins) | `npm run test:smoke` | - |
| **End-to-End Lifecycle** | `npm run test:e2e` | - |
| **All Browsers at once** | `npm run test:all-browsers` | `npm run test:all-browsers:headed` |
| **View HTML Test Report** | `npm run report` | - |
