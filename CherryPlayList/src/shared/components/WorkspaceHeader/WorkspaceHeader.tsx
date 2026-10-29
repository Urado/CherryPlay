import ClearIcon from '@mui/icons-material/Clear';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import TimerIcon from '@mui/icons-material/Timer';
import React from 'react';

import { formatDuration } from '../../utils/durationUtils';

const HEADER_ICON_SIZE = '18px';

export interface WorkspaceHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  itemCount: number;
  totalDuration: number;
  placeholder?: string;
  titleControl?: React.ReactNode;
  compactStats?: boolean;
  className?: string;

  hasSelectedItems: boolean;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemoveSelected?: () => void;
  canRemoveSelected?: boolean;

  canCreateGroup?: boolean;
  onCreateGroup?: () => void;

  onClearAll?: () => void;

  extraActions?: React.ReactNode;
  extraStats?: React.ReactNode;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  name,
  onNameChange,
  itemCount,
  totalDuration,
  placeholder = 'Название',
  titleControl,
  compactStats = false,
  className,
  hasSelectedItems,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onRemoveSelected,
  canRemoveSelected = true,
  canCreateGroup = false,
  onCreateGroup,
  onClearAll,
  extraActions,
  extraStats,
}) => {
  const showActions = hasSelectedItems || (!hasSelectedItems && itemCount > 0) || extraActions;

  return (
    <div className={`playlist-header-section${className ? ` ${className}` : ''}`}>
      <div className="playlist-header-toolbar">
        <div className="playlist-header-toolbar__primary">
          {titleControl ?? (
            <input
              type="text"
              className="playlist-name-input-header"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={placeholder}
            />
          )}

          <div className="playlist-stats-header playlist-stats-header--inline">
            <div className="playlist-stats-header__info">
              <ListIcon className="playlist-stats-header__icon" fontSize="inherit" aria-hidden="true" />
              {compactStats ? (
                <span
                  className="playlist-stats-header__count"
                  role="group"
                  aria-label={`${itemCount} треков`}
                  title={`${itemCount} треков`}
                >
                  <span aria-hidden="true">{itemCount}</span>
                </span>
              ) : (
                <span>{itemCount} треков</span>
              )}
              {itemCount > 0 && (
                compactStats ? (
                  <span className="playlist-stats-header__duration">
                    <span className="playlist-stats-header__sep" aria-hidden>
                      •
                    </span>
                    <TimerIcon className="playlist-stats-header__icon" fontSize="inherit" />
                    <span>{formatDuration(totalDuration)}</span>
                  </span>
                ) : (
                  <>
                    <span className="playlist-stats-header__sep" aria-hidden>
                      •
                    </span>
                    <TimerIcon className="playlist-stats-header__icon" fontSize="inherit" />
                    <span>{formatDuration(totalDuration)}</span>
                  </>
                )
              )}
              {extraStats}
            </div>
          </div>
        </div>

        {showActions ? (
          <div className="playlist-header-actions">
            {hasSelectedItems && (
              <>
                <button
                  onClick={onDeselectAll}
                  className="playlist-header-action-icon"
                  title="Снять выделение"
                  aria-label="Снять выделение"
                >
                  <ClearIcon style={{ fontSize: HEADER_ICON_SIZE }} />
                </button>
                {canCreateGroup && onCreateGroup && (
                  <button
                    onClick={onCreateGroup}
                    className="playlist-header-action-icon"
                    title="Создать группу"
                    aria-label="Создать группу"
                  >
                    <GroupAddIcon style={{ fontSize: HEADER_ICON_SIZE }} />
                  </button>
                )}
                {onRemoveSelected && (
                  <button
                    onClick={onRemoveSelected}
                    className="playlist-header-action-icon delete-button"
                    disabled={!canRemoveSelected}
                    title={
                      canRemoveSelected
                        ? `Удалить выбранные (${selectedCount})`
                        : 'Нельзя удалить проигранные или текущий трек во время проигрывания'
                    }
                    aria-label="Удалить выбранные"
                  >
                    <DeleteSweepIcon style={{ fontSize: HEADER_ICON_SIZE }} />
                  </button>
                )}
              </>
            )}
            {!hasSelectedItems && itemCount > 0 && (
              <>
                <button
                  onClick={onSelectAll}
                  className="playlist-header-action-icon"
                  title="Выбрать всё"
                  aria-label="Выбрать всё"
                >
                  <SelectAllIcon style={{ fontSize: HEADER_ICON_SIZE }} />
                </button>
                {onClearAll && (
                  <button
                    onClick={onClearAll}
                    className="playlist-header-action-icon delete-button"
                    title="Удалить всё"
                    aria-label="Удалить всё"
                  >
                    <DeleteForeverIcon style={{ fontSize: HEADER_ICON_SIZE }} />
                  </button>
                )}
              </>
            )}
            {extraActions}
          </div>
        ) : null}
      </div>
    </div>
  );
};

WorkspaceHeader.displayName = 'WorkspaceHeader';
