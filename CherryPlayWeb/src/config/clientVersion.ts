/**
 * Версия веб-клиента из CherryPlayServer/appsettings.json (ClientCompatibility.ServerVersion),
 * инжектируется при сборке через Vite define.
 */
export const CLIENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const CLIENT_VERSION_HEADER = 'X-Client-Version';
export const CLIENT_APP_HEADER = 'X-Client-App';
export const CLIENT_APP_ID = 'web';

export function getClientVersionHeaders(): Record<string, string> {
  return {
    [CLIENT_VERSION_HEADER]: CLIENT_VERSION,
    [CLIENT_APP_HEADER]: CLIENT_APP_ID,
  };
}
