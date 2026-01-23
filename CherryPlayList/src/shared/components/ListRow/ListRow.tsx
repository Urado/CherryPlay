import React, { useMemo } from 'react';

import { ListRowContextValue, ListRowProvider } from './ListRowContext';

/**
 * Props for the main ListRow component
 */
export interface ListRowProps {
  /** Unique identifier for the row */
  id: string;
  /** Whether the row is currently selected */
  isSelected?: boolean;
  /** Whether the row is being dragged */
  isDragging?: boolean;
  /** Whether the row is active (e.g., currently playing track) */
  isActive?: boolean;
  /** Whether the row is playing (for audio items) */
  isPlaying?: boolean;
  /** Whether the row is disabled */
  isDisabled?: boolean;
  /** Whether the row has been played (for session mode) */
  isPlayed?: boolean;
  /** Whether this is the current item (e.g., current track in player) */
  isCurrent?: boolean;
  /** Whether the row is locked (cannot be dragged/deleted) */
  isLocked?: boolean;
  /** Nesting level for hierarchical items (groups) */
  level?: number;
  /** Base CSS class name for styling */
  baseClassName?: string;
  /** Whether the row is draggable */
  draggable?: boolean;
  /** Whether the row is currently being dragged over */
  isDragOver?: boolean;
  /** Insert position indicator for drag and drop */
  insertPosition?: 'top' | 'bottom' | null;
  /** Additional CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Data attribute for item identification in drag/drop */
  'data-item-id'?: string;

  // Event handlers
  /** Called when the row is clicked */
  onClick?: (e: React.MouseEvent) => void;
  /** Called when drag starts */
  onDragStart?: (e: React.DragEvent) => void;
  /** Called during drag over */
  onDragOver?: (e: React.DragEvent) => void;
  /** Called when drag leaves */
  onDragLeave?: (e: React.DragEvent) => void;
  /** Called when item is dropped */
  onDrop?: (e: React.DragEvent) => void;
  /** Called when drag ends */
  onDragEnd?: (e: React.DragEvent) => void;
  /** Called on key down */
  onKeyDown?: (e: React.KeyboardEvent) => void;

  /** Child components */
  children: React.ReactNode;
}

/**
 * ListRow - Main container component for list items
 *
 * Uses Compound Components pattern to allow flexible composition of child elements.
 * Provides context to all children with row state information.
 *
 * @example
 * ```tsx
 * <ListRow
 *   id="track-1"
 *   isSelected={true}
 *   isDragging={false}
 *   draggable={true}
 *   onDragStart={handleDragStart}
 *   onClick={handleClick}
 * >
 *   <ListRow.DragHandle />
 *   <ListRow.Checkbox onToggle={handleToggle} />
 *   <ListRow.Index value={1} />
 *   <ListRow.Content>{track.name}</ListRow.Content>
 *   <ListRow.Secondary>{formatDuration(track.duration)}</ListRow.Secondary>
 *   <ListRow.Actions>
 *     <ListRow.PlayButton onClick={handlePlay} />
 *     <ListRow.DeleteButton onClick={handleDelete} />
 *   </ListRow.Actions>
 * </ListRow>
 * ```
 */
export const ListRow: React.FC<ListRowProps> = ({
  id,
  isSelected = false,
  isDragging = false,
  isActive = false,
  isPlaying = false,
  isDisabled = false,
  isPlayed = false,
  isCurrent = false,
  isLocked = false,
  level = 0,
  baseClassName = 'playlist-item',
  draggable = true,
  isDragOver = false,
  insertPosition = null,
  className,
  style,
  'data-item-id': dataItemId,
  onClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onKeyDown,
  children,
}) => {
  // Memoize context value to prevent unnecessary re-renders
  const contextValue: ListRowContextValue = useMemo(
    () => ({
      id,
      isSelected,
      isDragging,
      isActive,
      isPlaying,
      isDisabled,
      isPlayed,
      isCurrent,
      isLocked,
      level,
      baseClassName,
    }),
    [
      id,
      isSelected,
      isDragging,
      isActive,
      isPlaying,
      isDisabled,
      isPlayed,
      isCurrent,
      isLocked,
      level,
      baseClassName,
    ],
  );

  // Build CSS class names
  const computedClassName = [
    baseClassName,
    isSelected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
    insertPosition ? `insert-${insertPosition}` : '',
    isPlayed ? `${baseClassName}--played` : '',
    isDisabled ? `${baseClassName}--disabled` : '',
    isCurrent ? `${baseClassName}--current` : '',
    level > 0 ? `${baseClassName}--level-${level}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Compute styles with level-based indentation
  const computedStyle: React.CSSProperties = {
    ...(level > 0 ? { marginLeft: `calc(var(--spacing-md, 16px) * ${level})` } : {}),
    ...style,
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent);
    }
    onKeyDown?.(event);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    onDragStart?.(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isLocked) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    onDragOver?.(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isLocked) {
      return;
    }
    onDrop?.(e);
  };

  return (
    <ListRowProvider value={contextValue}>
      <div
        draggable={draggable && !isLocked}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        className={computedClassName}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-pressed={isSelected}
        aria-disabled={isDisabled}
        style={computedStyle}
        data-item-id={dataItemId ?? id}
      >
        {children}
      </div>
    </ListRowProvider>
  );
};

ListRow.displayName = 'ListRow';
