import {
  CHERRYPLAY_RECONNECT_ACTION_LABEL,
  CHERRYPLAY_RECONNECTION_FAILED_MESSAGE,
  createCherryPlayStreamingErrorHandlers,
  formatCherryPlayConnectError,
  formatCherryPlayPublishError,
  mapCherryPlayStreamingErrorPhrase,
} from '../../../src/shared/streaming/cherryPlayStreamingErrors';

describe('cherryPlayStreamingErrors', () => {
  it('maps known errors to short RU phrases', () => {
    expect(mapCherryPlayStreamingErrorPhrase(new Error('Failed to fetch'))).toBe('нет сети');
    expect(mapCherryPlayStreamingErrorPhrase(new Error('Request timeout'))).toBe('таймаут');
    expect(mapCherryPlayStreamingErrorPhrase(new Error('401 Unauthorized'))).toBe(
      'нет авторизации',
    );
    expect(mapCherryPlayStreamingErrorPhrase(new Error('weird-xyz'))).toBe('неизвестная ошибка');
  });

  it('formats connect and publish errors without raw detail', () => {
    expect(formatCherryPlayConnectError(new Error('timeout'))).toContain('таймаут');
    expect(formatCherryPlayConnectError(new Error('timeout'))).not.toContain('timeout');
    expect(formatCherryPlayPublishError('playlistPublish', new Error('put failed'))).toContain(
      'плейлист',
    );
    expect(formatCherryPlayPublishError('fullStatePublish', 'boom')).toContain('состояние');
    expect(formatCherryPlayPublishError('fullStatePublish', 'boom')).toContain(
      'неизвестная ошибка',
    );
  });

  it('notifies UI for connect, publish, and reconnection failed with reconnect action', () => {
    const notify = jest.fn();
    const onReconnect = jest.fn();
    const handlers = createCherryPlayStreamingErrorHandlers(notify, { onReconnect });

    handlers.onConnectError(new Error('offline'));
    handlers.onPublishError('playlistPublish', new Error('Failed to fetch'));
    handlers.onReconnectionFailed();

    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'error', message: expect.stringContaining('нет сети') }),
    );
    expect(notify).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'error', message: expect.stringContaining('плейлист') }),
    );
    expect(notify).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'warning',
        message: CHERRYPLAY_RECONNECTION_FAILED_MESSAGE,
        action: { label: CHERRYPLAY_RECONNECT_ACTION_LABEL, onAction: onReconnect },
      }),
    );
  });

  it('coalesces repeated connect/publish toasts within the window', () => {
    jest.useFakeTimers();
    const notify = jest.fn();
    const handlers = createCherryPlayStreamingErrorHandlers(notify);

    handlers.onConnectError(new Error('offline'));
    handlers.onConnectError(new Error('offline'));
    handlers.onPublishError('playlistPublish', new Error('Failed to fetch'));
    handlers.onPublishError('playlistPublish', new Error('Failed to fetch'));

    expect(notify).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(8_000);
    handlers.onConnectError(new Error('offline'));
    expect(notify).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });
});
