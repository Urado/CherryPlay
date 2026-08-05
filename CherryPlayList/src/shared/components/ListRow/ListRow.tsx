import React, { useMemo } from 'react';

import { ListRowContextValue, ListRowProvider } from './ListRowContext';

export interface ListRowProps {
  id: string;
  isSelected?: boolean;
  isDragging?: boolean;
  isActive?: boolean;
  isPlaying?: boolean;
  isDisabled?: boolean;
  isPlayed?: boolean;
  isCurrent?: boolean;
  isLocked?: boolean;
  level?: number;
  baseClassName?: string;
  draggable?: boolean;
  isDragOver?: boolean;
  insertPosition?: 'top' | 'bottom' | null;
  className?: string;
  style?: React.CSSProperties;
  'data-item-id'?: string;
  'data-file-path'?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}

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
  'data-file-path': dataFilePath,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onKeyDown,
  children,
}) => {
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

  const computedStyle: React.CSSProperties = {
    ...(level > 0 ? { marginLeft: `calc(var(--spacing-md, 16px) * ${level})` } : {}),
    ...style,
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
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
        onDoubleClick={onDoubleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-pressed={isSelected}
        aria-disabled={isDisabled}
        style={computedStyle}
        data-list-row=""
        data-item-id={dataItemId ?? id}
        data-file-path={dataFilePath}
      >
        {children}
      </div>
    </ListRowProvider>
  );
};

ListRow.displayName = 'ListRow';
