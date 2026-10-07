export const DESKTOP_AUTH_BROADCAST_CHANNEL = 'cherryplaylist-desktop-auth';

export const DESKTOP_AUTH_CODE_MESSAGE_TYPE = 'desktop-auth-code';

export const DESKTOP_AUTH_SESSION_READY_TYPE = 'desktop-auth-session-ready';

export const DESKTOP_AUTH_PENDING_CODE_KEY = 'cherryplaylist-pending-desktop-auth-code';

export type DesktopAuthCodeMessage = {
  type: typeof DESKTOP_AUTH_CODE_MESSAGE_TYPE;
  code: string;
};

export function isDesktopAuthCodeMessage(data: unknown): data is DesktopAuthCodeMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    record.type === DESKTOP_AUTH_CODE_MESSAGE_TYPE &&
    typeof record.code === 'string' &&
    record.code.trim().length > 0
  );
}

export function readPendingDesktopAuthCode(): string | null {
  try {
    const code = localStorage.getItem(DESKTOP_AUTH_PENDING_CODE_KEY);
    return code && code.trim() ? code.trim() : null;
  } catch {
    return null;
  }
}

export function writePendingDesktopAuthCode(code: string): void {
  localStorage.setItem(DESKTOP_AUTH_PENDING_CODE_KEY, code.trim());
}

export function clearPendingDesktopAuthCode(): void {
  try {
    localStorage.removeItem(DESKTOP_AUTH_PENDING_CODE_KEY);
  } catch {
    return;
  }
}
