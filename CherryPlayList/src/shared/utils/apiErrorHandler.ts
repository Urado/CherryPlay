import { handleAuthError, SESSION_EXPIRED_USER_MESSAGE } from './authErrorHandler';

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  code?: string;
}

const NON_SESSION_FORBIDDEN_CODES = new Set([
  'consent_required',
  'theme_not_entitled',
  'theme_not_visible',
  'admin_only',
]);

export async function handleApiResponse<T>(response: Response, defaultMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await createApiError(response, defaultMessage);

    if (isSessionAuthError(response.status, error.code)) {
      handleAuthError(error.message);
      throw new Error(SESSION_EXPIRED_USER_MESSAGE);
    }

    throw new Error(error.message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type');

  if (contentLength === '0' || (contentType && !contentType.includes('application/json'))) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text || text.trim().length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function createApiError(
  response: Response,
  defaultMessage: string,
): Promise<ApiError> {
  let errorMessage = defaultMessage;
  let code: string | undefined;

  try {
    const text = await response.text();
    if (text) {
      try {
        const json = JSON.parse(text) as {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
          code?: unknown;
        };
        const detail = typeof json.detail === 'string' ? json.detail : undefined;
        const message = typeof json.message === 'string' ? json.message : undefined;
        const error = typeof json.error === 'string' ? json.error : undefined;
        code = typeof json.code === 'string' ? json.code : undefined;
        errorMessage = detail || message || error || text;
        if (code && !errorMessage.includes(code)) {
          errorMessage = `${errorMessage} (${code})`;
        }
      } catch {
        errorMessage = text;
      }
    } else {
      errorMessage = response.statusText || defaultMessage;
    }
  } catch {
    errorMessage = response.statusText || defaultMessage;
  }

  return {
    message: errorMessage,
    status: response.status,
    statusText: response.statusText,
    code,
  };
}

export async function parseApiErrorPayload<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function isSessionAuthError(status: number, code?: string): boolean {
  if (status === 401) {
    return true;
  }
  if (status !== 403) {
    return false;
  }
  if (code && NON_SESSION_FORBIDDEN_CODES.has(code)) {
    return false;
  }
  return true;
}

export function isAuthError(status: number, code?: string): boolean {
  return isSessionAuthError(status, code);
}
