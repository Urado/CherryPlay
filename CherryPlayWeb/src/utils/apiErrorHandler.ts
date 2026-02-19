/**
 * Унифицированная обработка ошибок API для CherryPlayWeb
 */

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
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

  try {
    const text = await response.text();
    if (text) {
      // Пытаемся распарсить JSON с сообщением об ошибке
      try {
        const json = JSON.parse(text);
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
  };
}

/**
 * Проверяет статус ответа и обрабатывает специфичные ошибки авторизации
 */
export function isAuthError(status: number): boolean {
  return status === 401 || status === 403;
}
