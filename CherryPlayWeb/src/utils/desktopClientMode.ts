const DESKTOP_CLIENT_SESSION_KEY = 'cherryplay_client_desktop';
export const DESKTOP_CLIENT_HEADER = 'X-CherryPlay-Client';
export const DESKTOP_CLIENT_VALUE = 'desktop';

export function isDesktopClientQueryValue(value: string | null | undefined): boolean {
  return value?.toLowerCase() === DESKTOP_CLIENT_VALUE;
}

export function setDesktopClientMode(enabled: boolean): void {
  if (enabled) {
    sessionStorage.setItem(DESKTOP_CLIENT_SESSION_KEY, DESKTOP_CLIENT_VALUE);
    return;
  }
  sessionStorage.removeItem(DESKTOP_CLIENT_SESSION_KEY);
}

export function isDesktopClientMode(): boolean {
  return sessionStorage.getItem(DESKTOP_CLIENT_SESSION_KEY) === DESKTOP_CLIENT_VALUE;
}

export function syncDesktopClientModeFromQuery(client: string | null): void {
  setDesktopClientMode(isDesktopClientQueryValue(client));
}
