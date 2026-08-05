import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import React, { useState, useRef, useEffect, useCallback } from 'react';

import { ProjectItem, isProjectGroup } from '@core/types/project';
import { Track } from '@core/types/track';

import { formatTrackDuration } from '../../utils/durationUtils';
import { getGroupItemCount, getGroupTotalDuration } from '../../utils/playerItemsUtils';
import { useItemDragOver } from '../ItemList';
import { ListRowCompound } from '../ListRow';

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}

export type ProjectItemRowMode = 'playlist' | 'player-preparation' | 'player-session';

export interface ProjectItemRowProps {
  item: ProjectItem;
  index: number;
  listIndex: number;
  level?: number;
  mode: ProjectItemRowMode;

  isSelected: boolean;
  isDragging: boolean;
  isDragOver?: boolean;
  insertPosition?: 'top' | 'bottom' | null;

  isActive?: boolean;
  isPlaying?: boolean;

  isPlayed?: boolean;
  isDisabled?: boolean;
  isCurrent?: boolean;
  isLocked?: boolean;

  groupDuration?: number;
  isDuplicatePath?: boolean;
  isNotOnServer?: boolean;

  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onPlay?: (track: Track) => Promise<void> | void;
  onPause?: () => void;
  onToggleDisabled?: (itemId: string) => void;
  onRenameGroup?: (groupId: string, newName: string) => void;
  onUngroupGroup?: (groupId: string) => void;
  onOpenSettings?: (itemId: string) => void;
  onTrackActions?: (itemId: string, anchorRect: DOMRect) => void;
  trackActionsDisabled?: boolean;

  settingsButton?: React.ReactNode;
}

export const ProjectItemRow: React.FC<ProjectItemRowProps> = ({
  item,
  index,
  listIndex,
  level = 0,
  mode,
  isSelected,
  isDragging,
  isDragOver = false,
  insertPosition = null,
  isActive = false,
  isPlaying = false,
  isPlayed = false,
  isDisabled = false,
  isCurrent = false,
  isLocked = false,
  groupDuration,
  isDuplicatePath = false,
  isNotOnServer = false,
  onToggleSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPlay,
  onPause,
  onToggleDisabled,
  onRenameGroup,
  onUngroupGroup,
  onOpenSettings,
  onTrackActions,
  trackActionsDisabled = false,
  settingsButton,
}) => {
  const isGroup = isProjectGroup(item);
  const track = isGroup ? null : item;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const showPlayButton = !isGroup;
  const showDisableButton = mode === 'player-session';
  const showSettingsButton = mode !== 'playlist';

  const handlePlay = () => {
    if (!track || !onPlay) return;
    const maybePromise = onPlay(track);
    if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
      (maybePromise as Promise<void>).catch(() => undefined);
    }
  };

  const handlePause = () => {
    onPause?.();
  };

  const handleToggleDisabled = () => {
    onToggleDisabled?.(item.id);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    if (!isGroup || !onRenameGroup || isLocked) return;
    e.stopPropagation();
    setIsEditingName(true);
    setEditingName(item.name);
  };

  const handleSaveName = () => {
    if (!isGroup || !onRenameGroup) return;
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== item.name) {
      onRenameGroup(item.id, trimmedName);
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const itemCount = isGroup ? getGroupItemCount(item) : 0;
  const groupDisplayName = isGroup
    ? `${item.name} (${itemCount} ${pluralize(itemCount, 'элемент', 'элемента', 'элементов')})`
    : '';
  const trackDisplayName = track?.name || '';

  const displayDuration = isGroup
    ? groupDuration !== undefined && groupDuration > 0
      ? formatTrackDuration(groupDuration)
      : (() => {
          const baseDuration = getGroupTotalDuration(item);
          return baseDuration > 0 ? formatTrackDuration(baseDuration) : undefined;
        })()
    : track?.duration && track.duration > 0
      ? formatTrackDuration(track.duration)
      : undefined;

  const handleDragStart = (e: React.DragEvent) => {
    if (isEditingName) {
      e.preventDefault();
      return;
    }
    onDragStart(e, item.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isEditingName) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onDrop(e, item.id);
  };

  const { handleDragOver: updateContextDropIndex } = useItemDragOver({
    index: listIndex,
    disabled: isLocked || isEditingName,
  });

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (isEditingName) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      updateContextDropIndex(e);
      onDragOver(e);
    },
    [isEditingName, updateContextDropIndex, onDragOver],
  );

  const renderGroupNameContent = () => {
    if (isEditingName) {
      return (
        <>
          <input
            ref={inputRef}
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleNameKeyDown}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="playlist-item-group-name-input"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: 'var(--font-size-body)',
              color: 'var(--text-primary)',
              outline: 'none',
              flex: 1,
              minWidth: 0,
            }}
          />
          <span style={{ marginLeft: '4px' }}>
            ({itemCount} {pluralize(itemCount, 'элемент', 'элемента', 'элементов')})
          </span>
        </>
      );
    }

    return groupDisplayName;
  };

  return (
    <ListRowCompound
      id={item.id}
      isSelected={isSelected}
      isDragging={isDragging}
      isDragOver={isDragOver}
      insertPosition={insertPosition}
      isActive={isActive}
      isPlaying={isPlaying}
      isPlayed={isPlayed}
      isDisabled={isDisabled}
      isCurrent={isCurrent}
      isLocked={isLocked}
      level={level}
      draggable={!isLocked && !isEditingName}
      onClick={(e) => onToggleSelect(item.id, e)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={isGroup ? 'playlist-item--group' : ''}
      data-item-id={item.id}
    >
      {showPlayButton && track && onPlay && (
        <ListRowCompound.PlayButton onPlay={handlePlay} onPause={handlePause} />
      )}

      {isGroup && (
        <div className="playlist-item-group-icon">
          <FolderIcon style={{ fontSize: '20px', color: 'var(--text-secondary)' }} />
        </div>
      )}

      <ListRowCompound.DragHandle />

      <ListRowCompound.Checkbox onToggle={(e) => onToggleSelect(item.id, e)} />

      {isGroup && onUngroupGroup ? (
        <ListRowCompound.UngroupButton onUngroup={() => onUngroupGroup(item.id)} />
      ) : (
        <ListRowCompound.Index value={index} />
      )}

      <ListRowCompound.Content
        editable={isGroup && !!onRenameGroup && !isLocked}
        onDoubleClick={isGroup ? handleStartEdit : undefined}
        title={
          isGroup && onRenameGroup && !isLocked ? 'Двойной клик для переименования' : undefined
        }
      >
        {isGroup ? renderGroupNameContent() : trackDisplayName}
      </ListRowCompound.Content>

      {!isGroup && track && track.isMissing && (
        <span
          className="playlist-item-missing-dot"
          title={`Файл не найден: ${track.path}`}
          aria-label="Файл не найден"
          style={{ color: 'var(--warning, #ff9800)', fontSize: '14px', marginRight: '4px' }}
        >
          ⚠
        </span>
      )}

      {displayDuration && (
        <ListRowCompound.Secondary>
          {isNotOnServer && (
            <span
              className="playlist-item-not-on-server-dot"
              title="Трека нет в плейлисте на сервере"
              aria-label="Трека нет на сервере"
            />
          )}
          {isDuplicatePath && (
            <span
              className="playlist-item-duplicate-dot"
              title="Дубликат: такой трек уже есть в списке (по пути или имени файла)"
              aria-label="Дубликат"
            />
          )}
          {displayDuration}
        </ListRowCompound.Secondary>
      )}

      <ListRowCompound.Actions>
        {showSettingsButton &&
          (settingsButton ||
            (onOpenSettings && (
              <ListRowCompound.SettingsButton onClick={() => onOpenSettings(item.id)} />
            )))}

        {showDisableButton && onToggleDisabled && (
          <ListRowCompound.DisableButton onToggle={handleToggleDisabled} />
        )}

        {!isGroup && mode !== 'playlist' && (
          <ListRowCompound.ActionButton
            className="playlist-item-more"
            aria-label="Действия с треком"
            title={
              trackActionsDisabled || !onTrackActions
                ? undefined
                : 'Действия: перейти к треку, удалить и др.'
            }
            disabled={trackActionsDisabled || !onTrackActions}
            onClick={(e) => {
              if (!trackActionsDisabled && onTrackActions) {
                onTrackActions(item.id, (e.currentTarget as HTMLElement).getBoundingClientRect());
              }
            }}
            icon={<MoreVertIcon style={{ fontSize: '18px' }} />}
            variant="ghost"
            size="sm"
          />
        )}

        <ListRowCompound.DeleteButton onClick={() => onRemove(item.id)} />
      </ListRowCompound.Actions>
    </ListRowCompound>
  );
};

ProjectItemRow.displayName = 'ProjectItemRow';
