import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/common/LoginPage';
import { TicketQueuePage as AdminTicketQueuePage } from '../pages/admin/TicketQueuePage';
import { KnowledgeBasePage } from '../pages/admin/KnowledgeBasePage';
import { LeaveManagementPage } from '../pages/admin/LeaveManagementPage';
import { AlertManagementPage } from '../pages/admin/AlertManagementPage';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { ITStaffManagementPage } from '../pages/admin/ITStaffManagementPage';
import { EmployeeDashboardPage } from '../pages/employee/EmployeeDashboardPage';
import { MyTicketPage } from '../pages/employee/MyTicketPage';
import { ITDashboardPage } from '../pages/it-staff/ITDashboardPage';
import { TicketQueuePage as ITTicketQueuePage } from '../pages/it-staff/TicketQueuePage';
import { AlertCenterPage } from '../pages/it-staff/AlertCenterPage';
import { LeaveRequestPage } from '../pages/it-staff/LeaveRequestPage';
import { LeaveCalendarPage } from '../pages/it-staff/LeaveCalendarPage';

type Pages = {
  login: LoginPage;
  ticketQueue: AdminTicketQueuePage;
  knowledgeBase: KnowledgeBasePage;
  leaveManagement: LeaveManagementPage;
  alertManagement: AlertManagementPage;
  userManagement: UserManagementPage;
  itStaffManagement: ITStaffManagementPage;
  employeeDashboard: EmployeeDashboardPage;
  myTicket: MyTicketPage;
  itDashboard: ITDashboardPage;
  itTicketQueue: ITTicketQueuePage;
  alertCenter: AlertCenterPage;
  leaveRequest: LeaveRequestPage;
  leaveCalendar: LeaveCalendarPage;
};

export const test = base.extend<Pages>({
  login: async ({ page }, use) => use(new LoginPage(page)),
  ticketQueue: async ({ page }, use) => use(new AdminTicketQueuePage(page)),
  knowledgeBase: async ({ page }, use) => use(new KnowledgeBasePage(page)),
  leaveManagement: async ({ page }, use) => use(new LeaveManagementPage(page)),
  alertManagement: async ({ page }, use) => use(new AlertManagementPage(page)),
  userManagement: async ({ page }, use) => use(new UserManagementPage(page)),
  itStaffManagement: async ({ page }, use) => use(new ITStaffManagementPage(page)),
  employeeDashboard: async ({ page }, use) => use(new EmployeeDashboardPage(page)),
  myTicket: async ({ page }, use) => use(new MyTicketPage(page)),
  itDashboard: async ({ page }, use) => use(new ITDashboardPage(page)),
  itTicketQueue: async ({ page }, use) => use(new ITTicketQueuePage(page)),
  alertCenter: async ({ page }, use) => use(new AlertCenterPage(page)),
  leaveRequest: async ({ page }, use) => use(new LeaveRequestPage(page)),
  leaveCalendar: async ({ page }, use) => use(new LeaveCalendarPage(page)),
});

export { expect } from '@playwright/test';
