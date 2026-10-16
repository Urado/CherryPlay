export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  code?: string;
  details?: unknown;
}

const isApiError = (error: unknown): error is ApiError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<ApiError>;
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.statusText === 'string'
  );
};

export const handleApiResponse = async <T>(
  response: Response,
  defaultMessage: string,
): Promise<T> => {
  if (!response.ok) {
    const error = await createApiError(response, defaultMessage);
    throw Object.assign(new Error(error.message), error);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const payload: unknown = await response.json();
  return payload as T;
};

export const createApiError = async (
  response: Response,
  defaultMessage: string,
): Promise<ApiError> => {
  let errorMessage = defaultMessage;
  let code: string | undefined;
  let details: unknown;

  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        const json =
          parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
        code = typeof json?.code === 'string' ? json.code : undefined;
        details = json;
        errorMessage =
          (typeof json?.detail === 'string' && json.detail) ||
          (typeof json?.message === 'string' && json.message) ||
          (typeof json?.error === 'string' && json.error) ||
          text;
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
    details,
  };
};

export const parseApiErrorPayload = async <T>(response: Response): Promise<T | null> => {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const isAuthError = (status: number, code?: string): boolean => {
  if (status === 401) {
    return true;
  }
  if (status !== 403) {
    return false;
  }
  if (
    code === 'consent_required' ||
    code === 'theme_not_entitled' ||
    code === 'theme_not_visible' ||
    code === 'admin_only'
  ) {
    return false;
  }
  return true;
};

export const extractApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isApiError(error)) {
    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallbackMessage;
};
