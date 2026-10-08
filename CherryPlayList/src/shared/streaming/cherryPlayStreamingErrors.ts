export type CherryPlayPublishOperation = 'playlistPublish' | 'fullStatePublish';

export const CHERRYPLAY_RECONNECTION_FAILED_MESSAGE =
  'Не удалось автоматически переподключиться к серверу трансляции.';

export const CHERRYPLAY_RECONNECT_ACTION_LABEL = 'Переподключить';

const TOAST_COALESCE_MS = 8_000;

function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return '';
}

export function mapCherryPlayStreamingErrorPhrase(error: unknown): string {
  const detail = errorDetail(error).toLowerCase();
  if (!detail) {
    return 'неизвестная ошибка';
  }
  if (
    detail.includes('failed to fetch') ||
    detail.includes('networkerror') ||
    detail.includes('network request failed') ||
    detail.includes('err_network') ||
    detail.includes('offline')
  ) {
    return 'нет сети';
  }
  if (detail.includes('timeout') || detail.includes('timed out')) {
    return 'таймаут';
  }
  if (detail.includes('401') || detail.includes('unauthorized')) {
    return 'нет авторизации';
  }
  if (detail.includes('403') || detail.includes('forbidden')) {
    return 'доступ запрещён';
  }
  if (detail.includes('404') || detail.includes('not found')) {
    return 'не найдено';
  }
  if (
    detail.includes('500') ||
    detail.includes('502') ||
    detail.includes('503') ||
    detail.includes('internal server')
  ) {
    return 'ошибка сервера';
  }
  if (detail.includes('websocket') || detail.includes('connection') || detail.includes('connect')) {
    return 'нет соединения';
  }
  return 'неизвестная ошибка';
}

export function formatCherryPlayConnectError(error: unknown): string {
  return `Не удалось подключиться к трансляции: ${mapCherryPlayStreamingErrorPhrase(error)}`;
}

export function formatCherryPlayPublishError(
  operation: CherryPlayPublishOperation,
  error: unknown,
): string {
  const phrase = mapCherryPlayStreamingErrorPhrase(error);
  if (operation === 'playlistPublish') {
    return `Не удалось синхронизировать плейлист на сервер: ${phrase}`;
  }
  return `Не удалось опубликовать состояние трансляции: ${phrase}`;
}

export type CherryPlayStreamingNotify = (notification: {
  type: 'error' | 'warning';
  message: string;
  duration: number;
  action?: { label: string; onAction: () => void };
}) => void;

export interface CherryPlayStreamingErrorHandlerOptions {
  onReconnect?: () => void;
}

export function createCherryPlayStreamingErrorHandlers(
  notify: CherryPlayStreamingNotify,
  options?: CherryPlayStreamingErrorHandlerOptions,
) {
  const lastNotifiedAt = new Map<string, number>();

  const shouldNotify = (key: string): boolean => {
    const now = Date.now();
    const previous = lastNotifiedAt.get(key) ?? 0;
    if (now - previous < TOAST_COALESCE_MS) {
      return false;
    }
    lastNotifiedAt.set(key, now);
    return true;
  };

  return {
    onConnectError: (error: unknown) => {
      if (!shouldNotify('connect')) {
        return;
      }
      notify({
        type: 'error',
        message: formatCherryPlayConnectError(error),
        duration: 6000,
      });
    },
    onPublishError: (operation: CherryPlayPublishOperation, error: unknown) => {
      if (!shouldNotify(`publish:${operation}`)) {
        return;
      }
      notify({
        type: 'error',
        message: formatCherryPlayPublishError(operation, error),
        duration: 6000,
      });
    },
    onReconnectionFailed: () => {
      if (!shouldNotify('reconnectionFailed')) {
        return;
      }
      notify({
        type: 'warning',
        message: CHERRYPLAY_RECONNECTION_FAILED_MESSAGE,
        duration: 8000,
        action: options?.onReconnect
          ? { label: CHERRYPLAY_RECONNECT_ACTION_LABEL, onAction: options.onReconnect }
          : undefined,
      });
    },
  };
}
