import { Button, IconButton } from '@cherryplay/components';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SettingsIcon from '@mui/icons-material/Settings';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import TimerIcon from '@mui/icons-material/Timer';
import React from 'react';

import { formatTimeFromDuration } from '@shared/utils';

interface PlayerHeaderProps {
  allTracksCount: number;
  totalDuration: number;
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
}

const HEADER_ICON_SIZE = '18px';

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  allTracksCount,
  totalDuration,
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
}) => {
  const showSelectionActions = hasSelectedItems || (!hasSelectedItems && allTracksCount > 0);

  return (
    <div className="playlist-header-section player-header">
      <div className="playlist-header-toolbar">
        <div className="playlist-header-toolbar__primary">
          <div className="player-session-controls">
            {isPreparationMode ? (
              <Button
                onClick={onStartSession}
                disabled={allTracksCount === 0}
                className="player-session-button player-session-button--start"
                title={allTracksCount === 0 ? 'Добавьте треки в плейлист' : undefined}
                type="button"
                variant="primary"
                size="sm"
                data-party-header-guide-target="start-playback"
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
                title="Завершает сессию вечера, а не только ставит на паузу"
                data-party-header-guide-target="stop-playback"
              >
                Остановить проигрывание
              </Button>
            )}
          </div>

          <div className="playlist-stats-header playlist-stats-header--inline">
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
                    {formatTimeFromDuration(totalDuration)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="playlist-header-actions player-header-actions">
          {showSelectionActions ? (
            hasSelectedItems ? (
              <>
                <IconButton
                  onClick={onDeselectAll}
                  className="playlist-header-action-icon"
                  title="Снять выделение"
                  aria-label="Снять выделение"
                  icon={<ClearIcon style={{ fontSize: HEADER_ICON_SIZE }} />}
                  variant="ghost"
                  size="sm"
                ></IconButton>
                {canCreateGroup && (
                  <IconButton
                    onClick={onCreateGroup}
                    className="playlist-header-action-icon"
                    title="Создать группу"
                    aria-label="Создать группу"
                    icon={<GroupAddIcon style={{ fontSize: HEADER_ICON_SIZE }} />}
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
                      ? `Удалить выбранные (${selectedItemsCount})`
                      : 'Нельзя удалить проигранные или текущий трек во время проигрывания'
                  }
                  aria-label="Удалить выбранные"
                  icon={<DeleteSweepIcon style={{ fontSize: HEADER_ICON_SIZE }} />}
                  variant="ghost"
                  size="sm"
                ></IconButton>
              </>
            ) : (
              <IconButton
                onClick={onSelectAll}
                className="playlist-header-action-icon"
                title="Выделить все"
                aria-label="Выделить все"
                icon={<SelectAllIcon style={{ fontSize: HEADER_ICON_SIZE }} />}
                variant="ghost"
                size="sm"
              ></IconButton>
            )
          ) : null}

          <IconButton
            onClick={onOpenGlobalSettings}
            className="player-settings-icon"
            title="Настройки проигрывания"
            aria-label="Настройки проигрывания"
            icon={<SettingsIcon style={{ fontSize: HEADER_ICON_SIZE }} />}
            variant="ghost"
            size="sm"
          ></IconButton>

          <IconButton
            onClick={onExportTracksToText}
            className="player-settings-icon"
            title="Список треков в файл…"
            disabled={allTracksCount === 0}
            aria-label="Список треков в файл"
            icon={<TextSnippetIcon style={{ fontSize: HEADER_ICON_SIZE }} />}
            variant="ghost"
            size="sm"
          ></IconButton>
        </div>
      </div>
    </div>
  );
};
