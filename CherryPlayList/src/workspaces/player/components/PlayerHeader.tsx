import * as signalR from '@microsoft/signalr';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SettingsIcon from '@mui/icons-material/Settings';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import TimerIcon from '@mui/icons-material/Timer';
import React from 'react';

import { signalRService } from '@shared/services';
import { useSettingsStore } from '@shared/stores';
import { formatDuration } from '@shared/utils';

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
  onReconnectClick?: () => void;
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
  onReconnectClick,
}) => {
  const { enableStreaming } = useSettingsStore();

  const connectionErrorReason = signalRService.getConnectionErrorReason();
  const isConnected = connectionState === signalR.HubConnectionState.Connected;
  const isConnecting =
    connectionState === signalR.HubConnectionState.Connecting ||
    connectionState === signalR.HubConnectionState.Reconnecting;

  const isDisconnected = !isConnected && !isConnecting;
  const canReconnect = isDisconnected && onReconnectClick;

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
    return 'Неизвестная ошибка';
  };

  const connectionIndicator = (
    <div
      className={`player-connection-indicator ${
        isConnected
          ? 'player-connection-indicator--connected'
          : isConnecting
            ? 'player-connection-indicator--connecting'
            : 'player-connection-indicator--disconnected'
      } ${canReconnect ? 'player-connection-indicator--clickable' : ''}`}
      title={getConnectionTooltip()}
      role={canReconnect ? 'button' : undefined}
      tabIndex={canReconnect ? 0 : undefined}
      onClick={canReconnect ? onReconnectClick : undefined}
      onKeyDown={
        canReconnect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onReconnectClick?.();
              }
            }
          : undefined
      }
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
  );

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
        {enableStreaming && connectionIndicator}
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

        <button
          onClick={onOpenGlobalSettings}
          className="player-settings-icon"
          title="Глобальные настройки"
        >
          <SettingsIcon style={{ fontSize: '20px' }} />
        </button>

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
