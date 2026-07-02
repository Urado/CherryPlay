/**
 * Утилиты для работы с JWT токенами
 */

export interface TokenPayload {
  organizerId: string;
  name: string;
  exp: number;
  iat: number;
  jti: string;
}

/**
 * Constant-time string equality for sensitive values (e.g. bearer token cache keys).
 */
export function constantTimeStringEqual(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);

  let mismatch = lenA ^ lenB;
  for (let i = 0; i < maxLen; i += 1) {
    const charA = i < lenA ? a.charCodeAt(i) : 0;
    const charB = i < lenB ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }

  return mismatch === 0;
}

/**
 * Декодирует JWT токен и возвращает payload
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded as TokenPayload;
  } catch (error) {
    console.error('[TokenUtils] Failed to decode token:', error);
    return null;
  }
}

/**
 * Проверяет, истек ли токен
 */
export function isTokenExpired(token: string): boolean {
  if (token.startsWith('demo.cherryplaylist.')) {
    return false;
  }
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  // exp в секундах, конвертируем в миллисекунды
  const expirationTime = payload.exp * 1000;
  const now = Date.now();

  // Добавляем запас в 1 минуту для учета задержек сети
  return now >= expirationTime - 60000;
}

/**
 * Проверяет, истекает ли токен в ближайшие дни
 */
export function isTokenExpiringSoon(token: string, daysThreshold: number = 7): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expirationTime = payload.exp * 1000;
  const now = Date.now();
  const thresholdTime = daysThreshold * 24 * 60 * 60 * 1000; // дни в миллисекундах

  return expirationTime - now <= thresholdTime;
}

/**
 * Получает количество дней до истечения токена
 */
export function getDaysUntilExpiration(token: string): number | null {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return null;
  }

  const expirationTime = payload.exp * 1000;
  const now = Date.now();
  const diff = expirationTime - now;

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
