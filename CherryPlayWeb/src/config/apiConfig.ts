const viteApiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
export const API_BASE_URL =
  viteApiUrl && viteApiUrl.trim() !== '' ? viteApiUrl : isDev ? 'http://localhost:5000' : '';

if (isDev) {
  console.log('[apiConfig] Initialized:', {
    VITE_API_URL: viteApiUrl,
    isDev,
    API_BASE_URL,
  });
}

export const SIGNALR_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

export const API_ENDPOINTS = {
  CONFIG: '/api/config',

  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    OAUTH_START: (provider: string) => `/auth/${provider}/start`,
    OAUTH_CALLBACK: (provider: string) => `/auth/${provider}/callback`,
  },

  ORGANIZER: {
    ME: '/api/organizer/me',
    PROFILE: '/api/organizer/profile',
    SESSION_CHECK: '/api/organizer/session/check',
    THEME_ACCESS: '/api/organizer/me/theme-access',
  },

  ADMIN: {
    ORGANIZERS: '/api/admin/organizers',
    ORGANIZER_BY_ID: (organizerId: string) => `/api/admin/organizers/${organizerId}`,
    ORGANIZER_ENTITLEMENTS: (organizerId: string) =>
      `/api/admin/organizers/${organizerId}/entitlements`,
    ORGANIZER_ENTITLEMENT_BY_ID: (organizerId: string, entitlementId: string) =>
      `/api/admin/organizers/${organizerId}/entitlements/${entitlementId}`,
    THEME_PACKAGES: '/api/admin/theme-packages',
  },

  PARTIES: {
    MY: '/api/parties',
    BY_ID: (partyId: string) => `/api/parties/${partyId}`,
    LIFECYCLE: (partyId: string) => `/api/parties/${partyId}/lifecycle`,
    PUBLIC: {
      FIRST: '/api/parties/public/first',
      LIST: '/api/parties/public/list',
      BY_CODE: (shortCode: string) => `/api/parties/public/${shortCode}`,
      PLAYLIST: (shortCode: string) => `/api/parties/public/${shortCode}/playlist`,
      STATE: (shortCode: string) => `/api/parties/public/${shortCode}/state`,
    },
  },

  SIGNALR: {
    PARTY_HUB: '/partyHub',
  },
} as const;

export function getApiUrl(endpoint: string): string {
  if (!API_BASE_URL || API_BASE_URL.trim() === '') {
    return endpoint;
  }
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  if (import.meta.env.DEV) {
    console.log('[apiConfig] getApiUrl:', { endpoint, API_BASE_URL, fullUrl });
  }
  return fullUrl;
}

export function getSignalRUrl(hubPath: string): string {
  if (!SIGNALR_BASE_URL) {
    return hubPath;
  }
  return `${SIGNALR_BASE_URL}${hubPath}`;
}
