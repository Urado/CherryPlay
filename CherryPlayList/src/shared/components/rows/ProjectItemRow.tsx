import FolderIcon from '@mui/icons-material/Folder';
import React, { useState, useRef, useEffect, useCallback } from 'react';

import { ProjectItem, isProjectGroup } from '@core/types/project';
import { Track } from '@core/types/track';

import { formatTrackDuration } from '../../utils/durationUtils';
import { getGroupItemCount, getGroupTotalDuration } from '../../utils/playerItemsUtils';
import { useItemDragOver } from '../ItemList';
import { ListRowCompound } from '../ListRow';

/**
 * Склонение слова для русского языка
 * @param count - число
 * @param one - форма для 1 (элемент)
 * @param few - форма для 2-4 (элемента)
 * @param many - форма для 5-20, 0 (элементов)
 */
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

/**
 * Mode for ProjectItemRow display
 * - 'playlist': Basic mode for playlist view (no disable, no settings)
 * - 'player-preparation': Player in preparation mode (has settings, no disable)
 * - 'player-session': Player in session mode (has settings, has disable)
 */
export type ProjectItemRowMode = 'playlist' | 'player-preparation' | 'player-session';

/**
 * Props for ProjectItemRow component
 */
export interface ProjectItemRowProps {
  /** The item to display (track or group) */
  item: ProjectItem;
  /** Display index (for tracks only, -1 for groups) - used for showing track number */
  index: number;
  /** Position in the flat list - used for drag-over calculations and DropIndicator */
  listIndex: number;
  /** Nesting level for groups */
  level?: number;
  /** Display mode */
  mode: ProjectItemRowMode;

  // Selection state
  /** Whether the item is selected */
  isSelected: boolean;
  /** Whether the item is being dragged */
  isDragging: boolean;
  /** Whether another item is being dragged over this one */
  isDragOver?: boolean;
  /** Insert position indicator */
  insertPosition?: 'top' | 'bottom' | null;

  // Playback state
  /** Whether this is the active item in demo player */
  isActive?: boolean;
  /** Whether the item is currently playing */
  isPlaying?: boolean;

  // Session state (for player modes)
  /** Whether the track has been played (session mode) */
  isPlayed?: boolean;
  /** Whether the item is disabled (session mode) */
  isDisabled?: boolean;
  /** Whether this is the current track in player (session mode) */
  isCurrent?: boolean;
  /** Whether the item is locked (cannot be dragged/deleted) */
  isLocked?: boolean;

  // Group-specific
  /** Duration of the group including pauses (for groups only) */
  groupDuration?: number;
  /** Whether this track's path appears more than once in the list (show duplicate warning) */
  isDuplicatePath?: boolean;
  isNotOnServer?: boolean;

  // Callbacks
  /** Called when selection is toggled */
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  /** Called when item is removed */
  onRemove: (id: string) => void;
  /** Called when drag starts */
  onDragStart: (e: React.DragEvent, id: string) => void;
  /** Called during drag over */
  onDragOver: (e: React.DragEvent) => void;
  /** Called when item is dropped */
  onDrop: (e: React.DragEvent, id: string) => void;
  /** Called when drag ends */
  onDragEnd: (e: React.DragEvent) => void;
  /** Called when play is clicked (for tracks) */
  onPlay?: (track: Track) => Promise<void> | void;
  /** Called when pause is clicked */
  onPause?: () => void;
  /** Called when disable is toggled (session mode) */
  onToggleDisabled?: (itemId: string) => void;
  /** Called when group is renamed */
  onRenameGroup?: (groupId: string, newName: string) => void;
  /** Called when group is ungrouped */
  onUngroupGroup?: (groupId: string) => void;
  /** Called when settings button is clicked */
  onOpenSettings?: (itemId: string) => void;

  // Custom content
  /** Custom settings button (for player modes) */
  settingsButton?: React.ReactNode;
}

/**
 * ProjectItemRow - Universal component for displaying tracks and groups
 *
 * Supports three modes:
 * - 'playlist': Basic mode with play, delete buttons
 * - 'player-preparation': Player mode with settings button
 * - 'player-session': Player mode with settings and disable buttons
 */
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
  settingsButton,
}) => {
  const isGroup = isProjectGroup(item);
  const track = isGroup ? null : item;

  // Group name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine what to show based on mode
  const showPlayButton = mode === 'playlist' || (mode === 'player-preparation' && !isGroup);
  const showDisableButton = mode === 'player-session';
  const showSettingsButton = mode !== 'playlist';

  // Handle play click
  const handlePlay = () => {
    if (!track || !onPlay) return;
    const maybePromise = onPlay(track);
    if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
      (maybePromise as Promise<void>).catch(() => undefined);
    }
  };

  // Handle pause click
  const handlePause = () => {
    onPause?.();
  };

  // Handle toggle disabled
  const handleToggleDisabled = () => {
    onToggleDisabled?.(item.id);
  };

  // Group name editing handlers
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

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Calculate display values
  const itemCount = isGroup ? getGroupItemCount(item) : 0;
  const groupDisplayName = isGroup
    ? `${item.name} (${itemCount} ${pluralize(itemCount, 'элемент', 'элемента', 'элементов')})`
    : '';
  const trackDisplayName = track?.name || '';

  // Calculate duration
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

  // Handle drag events
  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, item.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    onDrop(e, item.id);
  };

  // Use hook to update ItemList context drop index when dragging over this item
  // listIndex is the position in the flat list (used for DropIndicator positioning)
  const { handleDragOver: updateContextDropIndex } = useItemDragOver({
    index: listIndex,
    disabled: isLocked,
  });

  // Combined drag over handler: updates both ItemList context and calls parent handler
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      // Update ItemList context for DropIndicator positioning
      updateContextDropIndex(e);
      // Call parent handler for other drag-over logic
      onDragOver(e);
    },
    [updateContextDropIndex, onDragOver],
  );

  // Render group name content (with editing support)
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
      draggable={!isLocked}
      onClick={(e) => onToggleSelect(item.id, e)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={isGroup ? 'playlist-item--group' : ''}
      data-item-id={item.id}
    >
      {/* Play button (for tracks in playlist/preparation mode) */}
      {showPlayButton && track && onPlay && (
        <ListRowCompound.PlayButton onPlay={handlePlay} onPause={handlePause} />
      )}

      {/* Group icon */}
      {isGroup && (
        <div className="playlist-item-group-icon">
          <FolderIcon style={{ fontSize: '20px', color: 'var(--text-secondary)' }} />
        </div>
      )}

      {/* Drag handle */}
      <ListRowCompound.DragHandle />

      {/* Checkbox */}
      <ListRowCompound.Checkbox onToggle={(e) => onToggleSelect(item.id, e)} />

      {/* Index or Ungroup button */}
      {isGroup && onUngroupGroup ? (
        <ListRowCompound.UngroupButton onUngroup={() => onUngroupGroup(item.id)} />
      ) : (
        <ListRowCompound.Index value={index} />
      )}

      {/* Content */}
      <ListRowCompound.Content
        editable={isGroup && !!onRenameGroup && !isLocked}
        onDoubleClick={isGroup ? handleStartEdit : undefined}
        title={
          isGroup && onRenameGroup && !isLocked ? 'Двойной клик для переименования' : undefined
        }
      >
        {isGroup ? renderGroupNameContent() : trackDisplayName}
      </ListRowCompound.Content>

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
              title="Дубликат: тот же файл уже есть в плейлисте"
              aria-label="Дубликат"
            />
          )}
          {displayDuration}
        </ListRowCompound.Secondary>
      )}

      {/* Actions */}
      <ListRowCompound.Actions>
        {/* Settings button (for player modes) */}
        {showSettingsButton &&
          (settingsButton ||
            (onOpenSettings && (
              <ListRowCompound.SettingsButton onClick={() => onOpenSettings(item.id)} />
            )))}

        {/* Disable button (for session mode) */}
        {showDisableButton && onToggleDisabled && (
          <ListRowCompound.DisableButton onToggle={handleToggleDisabled} />
        )}

        {/* Delete button */}
        <ListRowCompound.DeleteButton onClick={() => onRemove(item.id)} />
      </ListRowCompound.Actions>
    </ListRowCompound>
  );
};

ProjectItemRow.displayName = 'ProjectItemRow';
