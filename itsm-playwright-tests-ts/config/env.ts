export const BASE_URL = 'https://ithelpdesk.vlinklabs.com';

// Valid credentials pulled from the "All the possible passwords" sheet.
// Update here if the environment's test accounts change.
export const CREDENTIALS = {
  admin: {
    valid: { userId: 'admin@enterprise.com', password: 'Password@123' },
    validUserInvalidPassword: { userId: 'admin@enterprise.com', password: 'password@123' },
    invalidUserValidPassword: { userId: 'Admin@enterprise.com', password: 'Password@123' },
    invalidBoth: { userId: 'Admin@enterprise.com', password: 'password@123' },
  },
  itStaff: {
    valid: { userId: 'itmember@enterprise.com', password: '123123123' },
    validUserInvalidPassword: { userId: 'itmember@enterprise.com', password: '1231231321' },
    invalidUserValidPassword: { userId: 'uitmember05@enterprise.com', password: '123123123' },
    invalidBoth: { userId: 'itmember99@enterprise.com', password: '123123782' },
  },
  employee: {
    valid: { userId: 'employee77@enterprise.com', password: 'Employee123' },
    validUserInvalidPassword: { userId: 'employee77@enterprise.com', password: 'Employee23123' },
    invalidUserValidPassword: { userId: 'employ21ee77@enterprise.com', password: 'Employee123' },
    invalidBoth: { userId: 'employee2177@enterprise.com', password: 'Em122ployee123' },
  },
};

export type Role = keyof typeof CREDENTIALS;
