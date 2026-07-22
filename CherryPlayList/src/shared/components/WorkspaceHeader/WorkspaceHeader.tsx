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

/**
 * Props for WorkspaceHeader component
 */
export interface WorkspaceHeaderProps {
  /** Name of the workspace/project */
  name: string;
  /** Callback when name changes */
  onNameChange: (name: string) => void;
  /** Total number of items (tracks) */
  itemCount: number;
  /** Total duration in seconds */
  totalDuration: number;
  /** Placeholder text for name input */
  placeholder?: string;

  // Selection
  /** Whether there are selected items */
  hasSelectedItems: boolean;
  /** Number of selected items */
  selectedCount: number;
  /** Callback to select all items */
  onSelectAll: () => void;
  /** Callback to deselect all items */
  onDeselectAll: () => void;
  /** Callback to remove selected items */
  onRemoveSelected?: () => void;
  /** Whether selected items can be removed */
  canRemoveSelected?: boolean;

  // Groups (optional)
  /** Whether a group can be created from selection */
  canCreateGroup?: boolean;
  /** Callback to create a group from selected items */
  onCreateGroup?: () => void;

  // Clear all (optional)
  /** Callback to clear all items */
  onClearAll?: () => void;

  // Extra content
  /** Additional action buttons to render after standard buttons */
  extraActions?: React.ReactNode;
  /** Additional stats to render after duration */
  extraStats?: React.ReactNode;
}

/**
 * WorkspaceHeader - Unified header component for workspace views
 *
 * Provides consistent header UI across Playlist, Collection, and Player views:
 * - Name input
 * - Selection actions (select all, deselect, delete)
 * - Group creation button
 * - Stats display (item count, duration)
 *
 * @example
 * ```tsx
 * <WorkspaceHeader
 *   name={name}
 *   onNameChange={setName}
 *   itemCount={tracks.length}
 *   totalDuration={totalDuration}
 *   placeholder="Название проекта"
 *   hasSelectedItems={selectedIds.size > 0}
 *   selectedCount={selectedIds.size}
 *   onSelectAll={selectAll}
 *   onDeselectAll={deselectAll}
 *   onRemoveSelected={removeSelectedItems}
 *   canCreateGroup={canCreateGroup}
 *   onCreateGroup={handleCreateGroup}
 * />
 * ```
 */
export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  name,
  onNameChange,
  itemCount,
  totalDuration,
  placeholder = 'Название',
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
    <div className="playlist-header-section">
      <div className="playlist-header-toolbar">
        <input
          type="text"
          className="playlist-name-input-header"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholder}
        />

        <div className="playlist-stats-header playlist-stats-header--inline">
          <div className="playlist-stats-header__info">
            <ListIcon className="playlist-stats-header__icon" fontSize="inherit" />
            <span>{itemCount} треков</span>
            {itemCount > 0 && (
              <>
                <span className="playlist-stats-header__sep" aria-hidden>
                  •
                </span>
                <TimerIcon className="playlist-stats-header__icon" fontSize="inherit" />
                <span>{formatDuration(totalDuration)}</span>
              </>
            )}
            {extraStats}
          </div>
        </div>

        {showActions ? (
          <div className="playlist-header-actions">
            {hasSelectedItems && (
              <>
                <button
                  onClick={onDeselectAll}
                  className="playlist-header-action-icon"
                  title="Deselect All"
                  aria-label="Deselect All"
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
                        ? `Delete Selected (${selectedCount})`
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
                  title="Select All"
                  aria-label="Select All"
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
