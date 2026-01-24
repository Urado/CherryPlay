/**
 * Компонент для отображения статуса подключения к SignalR
 */
import React from 'react';
import './ConnectionStatus.css';

export interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected';
  isSessionActive?: boolean;
  showSessionIndicator?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  isSessionActive = false,
  showSessionIndicator = true,
}) => {
  const getStatusTitle = () => {
    switch (status) {
      case 'connected':
        return 'Подключено к SignalR';
      case 'connecting':
        return 'Подключение...';
      case 'disconnected':
        return 'Не подключено к SignalR';
      default:
        return '';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Подключено';
      case 'connecting':
        return 'Подключение...';
      case 'disconnected':
        return 'Отключено';
      default:
        return '';
    }
  };

  return (
    <div className="connection-status-container">
      <div className={`connection-status connection-status--${status}`} title={getStatusTitle()}>
        <span className={`connection-status-dot connection-status-dot--${status}`}></span>
        <span className="connection-status-text">{getStatusText()}</span>
      </div>
      {showSessionIndicator && status === 'connected' && isSessionActive && (
        <div className="connection-status-streaming" title="Трансляция идёт">
          <span className="connection-status-streaming-dot"></span>
          <span className="connection-status-streaming-text">В эфире</span>
        </div>
      )}
    </div>
  );
};
