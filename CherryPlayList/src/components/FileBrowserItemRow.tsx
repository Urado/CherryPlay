import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import React from 'react';

import { ListRowCompound } from '@shared/components/ListRow';

export interface FileBrowserItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface FileBrowserItemRowProps {
  item: FileBrowserItem;
  isSelected: boolean;
  isDragging: boolean;
  isAudioFile: boolean;
  isActiveAudio: boolean;
  isPlayingAudio: boolean;
  primaryContent: React.ReactNode;
  secondaryContent: React.ReactNode;
  onPlay: () => void;
  onPause: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export const FileBrowserItemRow: React.FC<FileBrowserItemRowProps> = ({
  item,
  isSelected,
  isDragging,
  isAudioFile,
  isActiveAudio,
  isPlayingAudio,
  primaryContent,
  secondaryContent,
  onPlay,
  onPause,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  onKeyDown,
}) => {
  return (
    <ListRowCompound
      id={item.path}
      isSelected={isSelected}
      isDragging={isDragging}
      isActive={isActiveAudio}
      isPlaying={isPlayingAudio}
      baseClassName="file-browser-item"
      draggable
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
      data-file-path={item.path}
    >
      {isAudioFile && <ListRowCompound.PlayButton onPlay={onPlay} onPause={onPause} />}
      {!isAudioFile && (
        <div className="file-browser-item-icon">
          {item.isDirectory ? (
            <FolderIcon className="folder-icon" />
          ) : (
            <InsertDriveFileIcon className="file-icon" />
          )}
        </div>
      )}
      <div className="file-browser-item-info">
        <ListRowCompound.Content>{primaryContent}</ListRowCompound.Content>
        {secondaryContent && (
          <ListRowCompound.Secondary>{secondaryContent}</ListRowCompound.Secondary>
        )}
      </div>
    </ListRowCompound>
  );
};

FileBrowserItemRow.displayName = 'FileBrowserItemRow';
