import React from 'react';

import './PartyConnectivityBanner.css';

export type PartyConnectivityBannerKind = 'offline' | 'unreachable';

export interface PartyConnectivityBannerProps {
  kind: PartyConnectivityBannerKind;
  isReconnecting?: boolean;
  lastManualCheckFailed?: boolean;
  onManualReconnect?: () => void;
}

export const PartyConnectivityBanner: React.FC<PartyConnectivityBannerProps> = ({
  kind,
  isReconnecting = false,
  lastManualCheckFailed = false,
  onManualReconnect,
}) => {
  if (kind === 'offline') {
    return (
      <div
        className="party-connectivity-banner party-connectivity-banner--offline"
        role="status"
        aria-live="polite"
      >
        <span className="party-connectivity-banner-title">Онлайн-функции отключены</span>
        <span className="party-connectivity-banner-hint">
          Включите «Онлайн» в настройках для работы с сервером. Локальное редактирование проекта
          доступно.
        </span>
      </div>
    );
  }

  return (
    <div
      className="party-connectivity-banner party-connectivity-banner--unreachable"
      role="status"
      aria-live="polite"
    >
      <span className="party-connectivity-banner-title">Не удалось подключиться к серверу</span>
      {isReconnecting && (
        <span className="party-connectivity-banner-hint">Проверка соединения...</span>
      )}
      {lastManualCheckFailed && !isReconnecting && (
        <span className="party-connectivity-banner-hint">Сервер недоступен</span>
      )}
      {onManualReconnect && (
        <button
          type="button"
          className="action-button party-connectivity-banner-retry"
          onClick={() => void onManualReconnect()}
          disabled={isReconnecting}
        >
          {isReconnecting ? 'Проверка...' : 'Проверить сейчас'}
        </button>
      )}
    </div>
  );
};
