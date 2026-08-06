export const ROUTES = {
  HOME: '/',
  PARTY_VIEW: (shortCode: string) => `/party/${shortCode}`,
  PARTY_INFO: (shortCode: string) => `/party/${shortCode}/info`,
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CABINET: '/cabinet',
  ADMIN_ROOT: '/admin',
  ADMIN_ORGANIZERS: '/admin/organizers',
  ADMIN_ORGANIZER_DETAIL: (organizerId: string) => `/admin/organizers/${organizerId}`,
} as const;
