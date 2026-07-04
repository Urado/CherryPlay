import * as signalR from '@microsoft/signalr';
import React from 'react';

import { signalRService } from '@shared/services';

export interface StreamingConnectionIndicatorProps {
  connectionState: signalR.HubConnectionState | null;
  onReconnect?: () => void;
  className?: string;
  compact?: boolean;
}

export const StreamingConnectionIndicator: React.FC<StreamingConnectionIndicatorProps> = ({
  connectionState,
  onReconnect,
  className,
  compact = false,
}) => {
  const connectionErrorReason = signalRService.getConnectionErrorReason();
  const isConnected = connectionState === signalR.HubConnectionState.Connected;
  const isConnecting =
    connectionState === signalR.HubConnectionState.Connecting ||
    connectionState === signalR.HubConnectionState.Reconnecting;

  const isDisconnected = !isConnected && !isConnecting;
  const canReconnect = isDisconnected && onReconnect;

  const getConnectionTooltip = () => {
    if (isConnected) {
      return 'Подключено к серверу';
    }
    if (isConnecting) {
      return 'Подключение...';
    }
    if (canReconnect) {
      return connectionErrorReason
        ? `${connectionErrorReason} Нажмите для переподключения.`
        : 'Нет соединения с сервером. Нажмите для переподключения.';
    }
    if (connectionErrorReason) {
      return connectionErrorReason;
    }
    return 'Нет соединения с сервером';
  };

  const statusLabel = isConnected ? 'Онлайн' : isConnecting ? 'Подключение…' : 'Нет связи';

  const rootClassName = [
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

  return (
    <div
      className={rootClassName}
      title={getConnectionTooltip()}
      role={canReconnect ? 'button' : undefined}
      tabIndex={canReconnect ? 0 : undefined}
      onClick={canReconnect ? onReconnect : undefined}
      onKeyDown={
        canReconnect
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onReconnect?.();
              }
            }
          : undefined
      }
      aria-label={getConnectionTooltip()}
    >
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
      {!compact ? (
        <span className="streaming-connection-indicator__label">{statusLabel}</span>
      ) : null}
    </div>
  );
};
