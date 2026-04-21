/**
 * Унифицированная обработка ошибок API для CherryPlayWeb
 */

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  code?: string;
  details?: unknown;
}

function isApiError(error: unknown): error is ApiError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<ApiError>;
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.statusText === 'string'
  );
}

/**
 * Обрабатывает ответ от API и выбрасывает ошибку если запрос неуспешен
 */
export async function handleApiResponse<T>(response: Response, defaultMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await createApiError(response, defaultMessage);
    throw error;
  }

  return response.json();
}

/**
 * Создает объект ошибки из Response
 */
export async function createApiError(
  response: Response,
  defaultMessage: string,
): Promise<ApiError> {
  let errorMessage = defaultMessage;
  let code: string | undefined;
  let details: unknown;

  try {
    const text = await response.text();
    if (text) {
      // Пытаемся распарсить JSON с сообщением об ошибке
      try {
        const json = JSON.parse(text);
        code = typeof json.code === 'string' ? json.code : undefined;
        details = json;
        errorMessage = json.detail || json.message || json.error || text;
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

/**
 * Проверяет статус ответа и обрабатывает специфичные ошибки авторизации
 */
export function isAuthError(status: number): boolean {
  return status === 401 || status === 403;
}

export function extractApiErrorMessage(error: unknown, fallbackMessage: string): string {
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
}
