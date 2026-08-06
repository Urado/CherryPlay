import * as signalR from '@microsoft/signalr';
import React from 'react';

import { signalRService } from '@shared/services';

export interface StreamingConnectionIndicatorProps {
  connectionState: signalR.HubConnectionState | null;
  onReconnect?: () => void;
  className?: string;
  compact?: boolean;
  hasLinkedParty?: boolean;
}

export const StreamingConnectionIndicator: React.FC<StreamingConnectionIndicatorProps> = ({
  connectionState,
  onReconnect,
  className,
  compact = false,
  hasLinkedParty = true,
}) => {
  const rawErrorReason = signalRService.getConnectionErrorReason();
  const connectionErrorReason = !hasLinkedParty
    ? 'Нет вечеринки'
    : rawErrorReason === 'Нет вечеринки'
      ? 'Нет соединения с сервером'
      : rawErrorReason;
  const isConnected = connectionState === signalR.HubConnectionState.Connected;
  const isConnecting =
    connectionState === signalR.HubConnectionState.Connecting ||
    connectionState === signalR.HubConnectionState.Reconnecting;

  const isDisconnected = !isConnected && !isConnecting;
  const canReconnect = hasLinkedParty && isDisconnected && Boolean(onReconnect);

  const getConnectionTooltip = () => {
    if (isConnected) {
      return 'Подключено к серверу';
    }
    if (isConnecting) {
      return 'Подключение...';
    }
    if (!hasLinkedParty) {
      return 'Нет вечеринки';
    }
    if (canReconnect) {
      return connectionErrorReason
        ? `${connectionErrorReason}. Нажмите для переподключения.`
        : 'Нет соединения с сервером. Нажмите для переподключения.';
    }
    if (connectionErrorReason) {
      return connectionErrorReason;
    }
    return 'Нет соединения с сервером';
  };

  const statusLabel = isConnected ? 'Онлайн' : isConnecting ? 'Подключение…' : 'Нет связи';

  const shellClassName = [
    'streaming-connection-indicator',
    isConnected
      ? 'streaming-connection-indicator--connected'
      : isConnecting
        ? 'streaming-connection-indicator--connecting'
        : 'streaming-connection-indicator--disconnected',
    canReconnect ? 'streaming-connection-indicator--clickable' : '',
    compact ? 'streaming-connection-indicator--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const tooltip = getConnectionTooltip();

  const statusDot = (
    <span
      className={`streaming-connection-indicator__dot ${
        isConnected
          ? 'streaming-connection-indicator__dot--connected'
          : isConnecting
            ? 'streaming-connection-indicator__dot--connecting'
            : 'streaming-connection-indicator__dot--disconnected'
      }`}
      aria-hidden
    />
  );

  if (compact) {
    return (
      <span className={shellClassName}>
        {canReconnect ? (
          <button
            type="button"
            className="streaming-connection-indicator__hit"
            title={tooltip}
            onClick={onReconnect}
            aria-label={tooltip}
          >
            {statusDot}
          </button>
        ) : (
          <span
            className="streaming-connection-indicator__hit"
            role="status"
            title={tooltip}
            aria-label={tooltip}
          >
            {statusDot}
          </span>
        )}
      </span>
    );
  }

  const content = (
    <>
      {statusDot}
      <span className="streaming-connection-indicator__label">{statusLabel}</span>
    </>
  );

  if (canReconnect) {
    return (
      <button
        type="button"
        className={shellClassName}
        title={tooltip}
        onClick={onReconnect}
        aria-label={tooltip}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={shellClassName} role="status" title={tooltip} aria-label={tooltip}>
      {content}
    </span>
  );
};
