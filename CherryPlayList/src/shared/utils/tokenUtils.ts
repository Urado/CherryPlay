export interface TokenPayload {
  organizerId: string;
  name: string;
  exp: number;
  iat: number;
  jti: string;
}

export const constantTimeStringEqual = (a: string, b: string): boolean => {
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
};

const isTokenPayload = (value: unknown): value is TokenPayload =>
  typeof value === 'object' &&
  value !== null &&
  'organizerId' in value &&
  typeof value.organizerId === 'string' &&
  'name' in value &&
  typeof value.name === 'string' &&
  'exp' in value &&
  typeof value.exp === 'number' &&
  'iat' in value &&
  typeof value.iat === 'number' &&
  'jti' in value &&
  typeof value.jti === 'string';

export const decodeToken = (token: string): TokenPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return isTokenPayload(decoded) ? decoded : null;
  } catch (error) {
    console.error('[TokenUtils] Failed to decode token:', error);
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  if (token.startsWith('demo.cherryplaylist.')) {
    return false;
  }
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expirationTime = payload.exp * 1000;
  const now = Date.now();

  return now >= expirationTime - 60000;
};

export const isTokenExpiringSoon = (token: string, daysThreshold: number = 7): boolean => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expirationTime = payload.exp * 1000;
  const now = Date.now();
  const thresholdTime = daysThreshold * 24 * 60 * 60 * 1000;

  return expirationTime - now <= thresholdTime;
};

export const getDaysUntilExpiration = (token: string): number | null => {
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
};
