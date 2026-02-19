/**
 * Централизованная конфигурация API
 * Все настройки API URL и эндпоинтов находятся здесь
 */

/**
 * Базовый URL API сервера
 * В продакшене используем относительные пути (nginx проксирует запросы)
 * В разработке используем VITE_API_URL или прямой URL к серверу для надежности
 */
const viteApiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
export const API_BASE_URL =
  viteApiUrl && viteApiUrl.trim() !== '' ? viteApiUrl : isDev ? 'http://localhost:5000' : '';

// Отладочный лог в dev режиме
if (isDev) {
  console.log('[apiConfig] Initialized:', {
    VITE_API_URL: viteApiUrl,
    isDev,
    API_BASE_URL,
  });
}

/**
 * Базовый URL для SignalR соединений
 * В продакшене используем относительные пути (nginx проксирует /partyHub)
 * В разработке SignalR требует прямой URL к серверу (WebSocket не работает через прокси Vite)
 */
export const SIGNALR_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

/**
 * Эндпоинты API
 */
export const API_ENDPOINTS = {
  // Аутентификация
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    OAUTH_START: (provider: string) => `/auth/${provider}/start`,
    OAUTH_CALLBACK: (provider: string) => `/auth/${provider}/callback`,
  },

  // Организатор
  ORGANIZER: {
    ME: '/api/organizer/me',
    PROFILE: '/api/organizer/profile',
    SESSION_CHECK: '/api/organizer/session/check',
  },

  // Вечеринки (публичные и организатор)
  PARTIES: {
    MY: '/api/parties',
    BY_ID: (partyId: string) => `/api/parties/${partyId}`,
    PUBLIC: {
      FIRST: '/api/parties/public/first',
      LIST: '/api/parties/public/list',
      BY_CODE: (shortCode: string) => `/api/parties/public/${shortCode}`,
      PLAYLIST: (shortCode: string) => `/api/parties/public/${shortCode}/playlist`,
      STATE: (shortCode: string) => `/api/parties/public/${shortCode}/state`,
    },
  },

  // SignalR Hub
  SIGNALR: {
    PARTY_HUB: '/partyHub',
  },
} as const;

/**
 * Получить полный URL для API эндпоинта
 */
export function getApiUrl(endpoint: string): string {
  // Если API_BASE_URL пустой, возвращаем относительный путь (для прокси Vite/nginx)
  if (!API_BASE_URL || API_BASE_URL.trim() === '') {
    return endpoint;
  }
  // Если API_BASE_URL задан, объединяем его с эндпоинтом
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  // Отладочный лог в dev режиме
  if (import.meta.env.DEV) {
    console.log('[apiConfig] getApiUrl:', { endpoint, API_BASE_URL, fullUrl });
  }
  return fullUrl;
}

/**
 * Получить полный URL для SignalR Hub
 * SignalR требует прямой URL к серверу, так как WebSocket не работает через прокси Vite
 */
export function getSignalRUrl(hubPath: string): string {
  // Если SIGNALR_BASE_URL пустой, возвращаем относительный путь (для продакшена с nginx)
  if (!SIGNALR_BASE_URL) {
    return hubPath;
  }
  // Объединяем базовый URL с путем к Hub
  return `${SIGNALR_BASE_URL}${hubPath}`;
}
