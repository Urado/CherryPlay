/**
 * Константы маршрутов приложения.
 * Единственный источник правды для путей навигации.
 */

export const ROUTES = {
  HOME: '/',
  PARTY_VIEW: (shortCode: string) => `/party/${shortCode}`,
  PARTY_INFO: (shortCode: string) => `/party/${shortCode}/info`,
  LOGIN: '/login',
  REGISTER: '/register',
  CABINET: '/cabinet',
} as const;
