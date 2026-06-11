import React from 'react';

import './OnlineUnavailablePanel.css';

export type OnlineUnavailableReason = 'connection' | 'outdated';

interface OnlineUnavailablePanelProps {
  reason: OnlineUnavailableReason;
  requiredVersion?: string | null;
  isReconnecting?: boolean;
  lastCheckFailed?: boolean;
  onRetry?: () => void;
}

export const OnlineUnavailablePanel: React.FC<OnlineUnavailablePanelProps> = ({
  reason,
  requiredVersion = null,
  isReconnecting = false,
  lastCheckFailed = false,
  onRetry,
}) => {
  if (reason === 'outdated') {
    const versionHint =
      requiredVersion !== null
        ? `Требуется версия ${requiredVersion} или новее.`
        : 'Установите новую версию CherryPlayList.';

    return (
      <div className="online-unavailable-panel">
        <div className="online-unavailable-panel-icon">⬆️</div>
        <p className="online-unavailable-panel-title">Версия приложения устарела</p>
        <p className="online-unavailable-panel-hint">{versionHint}</p>
        <p className="online-unavailable-panel-hint">
          Онлайн-функции недоступны. Локальная работа с проектом по-прежнему возможна.
        </p>
      </div>
    );
  }

  return (
    <div className="online-unavailable-panel">
      <div className="online-unavailable-panel-icon">🔌</div>
      <p className="online-unavailable-panel-title">Не удалось подключиться к серверу</p>
      {isReconnecting && <p className="online-unavailable-panel-hint">Проверка соединения...</p>}
      {onRetry && (
        <button
          className="action-button online-unavailable-panel-retry"
          onClick={onRetry}
          disabled={isReconnecting}
          type="button"
        >
          {isReconnecting ? 'Проверка...' : 'Проверить сейчас'}
        </button>
      )}
      {lastCheckFailed && !isReconnecting && (
        <p className="online-unavailable-panel-hint">Сервер недоступен</p>
      )}
    </div>
  );
};
