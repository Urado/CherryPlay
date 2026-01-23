import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SettingsIcon from '@mui/icons-material/Settings';
import TimerIcon from '@mui/icons-material/Timer';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import React from 'react';
import * as signalR from '@microsoft/signalr';

import { formatDuration } from '@shared/utils';
import { signalRService } from '@shared/services';

interface PlayerHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  allTracksCount: number;
  totalDuration: number;
  projectedEndTime: string | null;
  hasSelectedItems: boolean;
  canCreateGroup: boolean;
  canRemoveSelectedItems: boolean;
  selectedItemsCount: number;
  isPreparationMode: boolean;
  onDeselectAll: () => void;
  onCreateGroup: () => void;
  onRemoveSelectedItems: () => void;
  onSelectAll: () => void;
  onStartSession: () => void;
  onResetSession: () => void;
  onOpenGlobalSettings: () => void;
  onExportTracksToText: () => void;
  connectionState: signalR.HubConnectionState | null;
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  name,
  onNameChange,
  allTracksCount,
  totalDuration,
  projectedEndTime,
  hasSelectedItems,
  canCreateGroup,
  canRemoveSelectedItems,
  selectedItemsCount,
  isPreparationMode,
  onDeselectAll,
  onCreateGroup,
  onRemoveSelectedItems,
  onSelectAll,
  onStartSession,
  onResetSession,
  onOpenGlobalSettings,
  onExportTracksToText,
  connectionState,
}) => {
  // Получаем человекочитаемую причину ошибки
  const connectionErrorReason = signalRService.getConnectionErrorReason();
  const isConnected = connectionState === signalR.HubConnectionState.Connected;
  const isConnecting = connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting;
  
  // Формируем текст для tooltip
  const getConnectionTooltip = () => {
    if (isConnected) {
      return 'Подключено к серверу';
    }
    if (isConnecting) {
      return 'Подключение...';
    }
    if (connectionErrorReason) {
      return connectionErrorReason;
    }
    return 'Неизвестная ошибка';
  };

  return (
    <div className="playlist-header-section">
      <div className="playlist-header-row">
        <input
          type="text"
          className="playlist-name-input-header"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Player"
        />
        {/* Индикатор соединения SignalR */}
        <div
          className={`player-connection-indicator ${
            isConnected
              ? 'player-connection-indicator--connected'
              : isConnecting
              ? 'player-connection-indicator--connecting'
              : 'player-connection-indicator--disconnected'
          }`}
          title={getConnectionTooltip()}
        >
          <span
            className={`player-connection-dot ${
              isConnected
                ? 'player-connection-dot--connected'
                : isConnecting
                ? 'player-connection-dot--connecting'
                : 'player-connection-dot--disconnected'
            }`}
          />
        </div>
        {hasSelectedItems && (
          <>
            <button
              onClick={onDeselectAll}
              className="playlist-header-action-icon"
              title="Deselect All"
            >
              <ClearIcon style={{ fontSize: '20px' }} />
            </button>
            {canCreateGroup && (
              <button
                onClick={onCreateGroup}
                className="playlist-header-action-icon"
                title="Создать группу"
              >
                <GroupAddIcon style={{ fontSize: '20px' }} />
              </button>
            )}
            <button
              onClick={onRemoveSelectedItems}
              className="playlist-header-action-icon delete-button"
              disabled={!canRemoveSelectedItems}
              title={
                canRemoveSelectedItems
                  ? `Delete Selected (${selectedItemsCount})`
                  : 'Нельзя удалить проигранные или текущий трек в режиме сессии'
              }
            >
              <DeleteSweepIcon style={{ fontSize: '20px' }} />
            </button>
          </>
        )}
        {!hasSelectedItems && allTracksCount > 0 && (
          <button onClick={onSelectAll} className="playlist-header-action-icon" title="Select All">
            <SelectAllIcon style={{ fontSize: '20px' }} />
          </button>
        )}
      </div>
      <div className="playlist-stats-header">
        <ListIcon style={{ fontSize: '18px', marginRight: '4px' }} />
        <span>{allTracksCount} треков</span>
        {allTracksCount > 0 && (
          <>
            <span style={{ margin: '0 8px' }}>•</span>
            <TimerIcon style={{ fontSize: '18px', marginRight: '4px' }} />
            <span>{formatDuration(totalDuration)}</span>
            {projectedEndTime !== null && (
              <>
                <span style={{ margin: '0 8px' }}>•</span>
                <span>Окончание: {projectedEndTime}</span>
              </>
            )}
          </>
        )}
      </div>

      <div className="player-header-actions">
        {/* Кнопка Начать сессию / Сбросить */}
        <div className="player-session-controls">
          {isPreparationMode ? (
            <button
              onClick={onStartSession}
              disabled={allTracksCount === 0}
              className="player-session-button player-session-button--start"
            >
              Начать сессию
            </button>
          ) : (
            <button
              onClick={onResetSession}
              className="player-session-button player-session-button--reset"
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Иконка глобальных настроек */}
        <button
          onClick={onOpenGlobalSettings}
          className="player-settings-icon"
          title="Глобальные настройки"
        >
          <SettingsIcon style={{ fontSize: '20px' }} />
        </button>

        {/* Кнопка экспорта треков в текстовый файл */}
        <button
          onClick={onExportTracksToText}
          className="player-settings-icon"
          title="Выгрузить треки в текстовый файл"
          disabled={allTracksCount === 0}
        >
          <TextSnippetIcon style={{ fontSize: '20px' }} />
        </button>
      </div>
    </div>
  );
};
