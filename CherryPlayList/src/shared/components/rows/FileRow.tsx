import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import React from 'react';

import { ListRowCompound } from '../ListRow';

/**
 * File item data structure
 */
export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

/**
 * Props for FileRow component
 */
export interface FileRowProps {
  /** The file item to display */
  item: FileItem;
  /** Whether the item is selected */
  isSelected: boolean;
  /** Whether the item is being dragged */
  isDragging?: boolean;
  /** Whether this is an audio file */
  isAudioFile?: boolean;
  /** Whether this audio file is currently active in demo player */
  isActive?: boolean;
  /** Whether the audio is currently playing */
  isPlaying?: boolean;

  // Callbacks
  /** Called when the item is clicked */
  onClick: (e: React.MouseEvent, path: string) => void;
  /** Called when the item is double-clicked */
  onDoubleClick: (item: FileItem) => void;
  /** Called when drag starts */
  onDragStart: (e: React.DragEvent, path: string) => void;
  /** Called when drag ends */
  onDragEnd: () => void;
  /** Called when key is pressed */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>, item: FileItem) => void;
  /** Called when play is clicked (for audio files) */
  onPlay?: () => void;
  /** Called when pause is clicked (for audio files) */
  onPause?: () => void;
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${kb.toFixed(1)} KB`;
}

/**
 * FileRow - Component for displaying files and folders in FileBrowser
 *
 * Uses ListRowCompound for consistent styling with other list views.
 */
export const FileRow: React.FC<FileRowProps> = ({
  item,
  isSelected,
  isDragging = false,
  isAudioFile = false,
  isActive = false,
  isPlaying = false,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  onKeyDown,
  onPlay,
  onPause,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    onClick(e, item.path);
  };

  const handleDoubleClick = () => {
    onDoubleClick(item);
  };

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, item.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    onKeyDown?.(e as React.KeyboardEvent<HTMLDivElement>, item);
  };

  const handlePlay = () => {
    onPlay?.();
  };

  const handlePause = () => {
    onPause?.();
  };

  return (
    <ListRowCompound
      id={item.path}
      isSelected={isSelected}
      isDragging={isDragging}
      isActive={isActive}
      isPlaying={isPlaying}
      draggable={true}
      baseClassName="file-browser-item"
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={handleKeyDown}
      data-item-id={item.path}
    >
      {/* File/Folder icon */}
      <div className="file-browser-item-icon" onDoubleClick={handleDoubleClick}>
        {item.isDirectory ? (
          <FolderIcon className="folder-icon" />
        ) : (
          <InsertDriveFileIcon className="file-icon" />
        )}
      </div>

      {/* File info */}
      <div className="file-browser-item-info" onDoubleClick={handleDoubleClick}>
        <ListRowCompound.Content>{item.name}</ListRowCompound.Content>
        {!item.isDirectory && item.size && (
          <ListRowCompound.Secondary>{formatFileSize(item.size)}</ListRowCompound.Secondary>
        )}
      </div>

      {/* Play button for audio files */}
      {isAudioFile && onPlay && (
        <ListRowCompound.Actions>
          <ListRowCompound.PlayButton onPlay={handlePlay} onPause={handlePause} />
        </ListRowCompound.Actions>
      )}
    </ListRowCompound>
  );
};

FileRow.displayName = 'FileRow';
