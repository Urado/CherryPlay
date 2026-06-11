import { APP_VERSION } from './appVersion';

/**
 * Версия desktop-клиента из package.json (инжектируется при сборке через Vite define).
 */
export const CLIENT_VERSION = APP_VERSION;

export const CLIENT_VERSION_HEADER = 'X-Client-Version';
export const CLIENT_APP_HEADER = 'X-Client-App';
export const CLIENT_APP_ID = 'desktop';

export function getClientVersionHeaders(): Record<string, string> {
  return {
    [CLIENT_VERSION_HEADER]: CLIENT_VERSION,
    [CLIENT_APP_HEADER]: CLIENT_APP_ID,
  };
}
