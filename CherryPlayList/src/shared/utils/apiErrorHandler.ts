/**
 * Унифицированная обработка ошибок API для CherryPlayList
 */

import { handleAuthError } from './authErrorHandler';

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

    // Обработка ошибок авторизации
    if (isAuthError(response.status)) {
      handleAuthError(error.message);
    }

    throw new Error(error.message);
  }

  // Обработка пустого ответа (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  // Проверяем Content-Length и Content-Type перед чтением тела
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type');

  // Если Content-Length = 0 или отсутствует Content-Type с JSON, возвращаем undefined
  if (contentLength === '0' || (contentType && !contentType.includes('application/json'))) {
    return undefined as T;
  }

  // Читаем тело ответа
  const text = await response.text();

  // Если тело пустое, возвращаем undefined
  if (!text || text.trim().length === 0) {
    return undefined as T;
  }

  // Парсим JSON
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}`);
  }
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
