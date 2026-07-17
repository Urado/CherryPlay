import { Button, IconButton } from '@cherryplay/components';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SettingsIcon from '@mui/icons-material/Settings';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import TimerIcon from '@mui/icons-material/Timer';
import React from 'react';

import { formatTimeFromDuration, formatTimeFromTimestamp } from '@shared/utils';

import { PlaybackSourceSwitcher } from './PlaybackSourceSwitcher';

interface PlayerHeaderProps {
  allTracksCount: number;
  totalDuration: number;
  /** Прогноз окончания сессии: UNIX epoch в мс (локальные часы, отображение через formatTimeFromTimestamp → hh:mm:ss) */
  projectedEndTime: number | null;
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
  onCalculateLoudness?: () => void;
  showLoudnessBatchButton?: boolean;
  isLoudnessBatchScanning?: boolean;
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({
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
  onCalculateLoudness,
  showLoudnessBatchButton = false,
  isLoudnessBatchScanning = false,
}) => {
  const showSelectionActions = hasSelectedItems || (!hasSelectedItems && allTracksCount > 0);

  return (
    <div className="playlist-header-section">
      <div className="playlist-header-source-row">
        <PlaybackSourceSwitcher layout="topRow" />
      </div>
      <div className="playlist-stats-header">
        <div className="playlist-stats-header__info">
          <ListIcon className="playlist-stats-header__icon" fontSize="inherit" />
          <span>{allTracksCount === 0 ? 'Плейлист пуст' : `${allTracksCount} треков`}</span>
          {allTracksCount > 0 && (
            <>
              <span className="playlist-stats-header__sep" aria-hidden>
                •
              </span>
              <TimerIcon className="playlist-stats-header__icon" fontSize="inherit" />
              <span title="Суммарная длительность (накопленная по таймлайну проигрывания): hh:mm:ss">
                Длительность: {formatTimeFromDuration(totalDuration)}
              </span>
              {projectedEndTime !== null && (
                <>
                  <span className="playlist-stats-header__sep" aria-hidden>
                    •
                  </span>
                  <span title="Прогноз времени окончания по локальным часам: hh:mm:ss (formatTimeFromTimestamp)">
                    Окончание: {formatTimeFromTimestamp(projectedEndTime)}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {showSelectionActions ? (
          <div className="playlist-header-actions">
            {hasSelectedItems ? (
              <>
                <IconButton
                  onClick={onDeselectAll}
                  className="playlist-header-action-icon"
                  title="Deselect All"
                  aria-label="Deselect All"
                  icon={<ClearIcon style={{ fontSize: '20px' }} />}
                  variant="ghost"
                  size="sm"
                ></IconButton>
                {canCreateGroup && (
                  <IconButton
                    onClick={onCreateGroup}
                    className="playlist-header-action-icon"
                    title="Создать группу"
                    aria-label="Создать группу"
                    icon={<GroupAddIcon style={{ fontSize: '20px' }} />}
                    variant="ghost"
                    size="sm"
                  ></IconButton>
                )}
                <IconButton
                  onClick={onRemoveSelectedItems}
                  className="playlist-header-action-icon delete-button"
                  disabled={!canRemoveSelectedItems}
                  title={
                    canRemoveSelectedItems
                      ? `Delete Selected (${selectedItemsCount})`
                      : 'Нельзя удалить проигранные или текущий трек во время проигрывания'
                  }
                  aria-label="Удалить выбранные"
                  icon={<DeleteSweepIcon style={{ fontSize: '20px' }} />}
                  variant="ghost"
                  size="sm"
                ></IconButton>
              </>
            ) : (
              <IconButton
                onClick={onSelectAll}
                className="playlist-header-action-icon"
                title="Select All"
                aria-label="Select All"
                icon={<SelectAllIcon style={{ fontSize: '20px' }} />}
                variant="ghost"
                size="sm"
              ></IconButton>
            )}
          </div>
        ) : null}
      </div>

      <div className="player-header-actions">
        <div className="player-session-controls">
          {isPreparationMode && showLoudnessBatchButton && onCalculateLoudness && (
            <button
              type="button"
              onClick={onCalculateLoudness}
              disabled={allTracksCount === 0 || isLoudnessBatchScanning}
              className="player-session-button player-session-button--loudness"
              title="Рассчитать нормализацию громкости для всех треков"
            >
              <GraphicEqIcon style={{ fontSize: '18px', marginRight: '6px' }} />
              Рассчитать нормализацию
            </button>
          )}
          {isPreparationMode ? (
            <Button
              onClick={onStartSession}
              disabled={allTracksCount === 0 || isLoudnessBatchScanning}
              className="player-session-button player-session-button--start"
              title={allTracksCount === 0 ? 'Добавьте треки в плейлист' : undefined}
              type="button"
              variant="primary"
              size="sm"
            >
              Начать проигрывание
            </Button>
          ) : (
            <Button
              onClick={onResetSession}
              className="player-session-button player-session-button--reset"
              type="button"
              variant="secondary"
              size="sm"
            >
              Остановить проигрывание
            </Button>
          )}
        </div>

        <IconButton
          onClick={onOpenGlobalSettings}
          className="player-settings-icon"
          title="Настройки проигрывания"
          aria-label="Настройки проигрывания"
          icon={<SettingsIcon style={{ fontSize: '20px' }} />}
          variant="ghost"
          size="sm"
        ></IconButton>

        <IconButton
          onClick={onExportTracksToText}
          className="player-settings-icon"
          title="Список треков в файл…"
          disabled={allTracksCount === 0}
          aria-label="Список треков в файл"
          icon={<TextSnippetIcon style={{ fontSize: '20px' }} />}
          variant="ghost"
          size="sm"
        ></IconButton>
      </div>
    </div>
  );
};
