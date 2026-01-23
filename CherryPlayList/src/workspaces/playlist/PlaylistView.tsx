import React, { useCallback, useMemo } from 'react';

import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { ItemList, DropIndicator, ProjectItemRow, EmptyState, WorkspaceHeader } from '@shared/components';
import {
  useWorkspaceDragAndDrop,
  useTrackDuration,
  usePlaybackPreview,
  useSelectionWithModifiers,
  useDragDropExecutor,
} from '@shared/hooks';
import { fileService, ipcService } from '@shared/services';
import { useListShortcuts } from '@shared/shortcuts';
import { useProjectStore, useSettingsStore, useUIStore } from '@shared/stores';
import { isItemDragState } from '@shared/stores/dragDropStore';
import { logger, calculateSimpleDividerMarkers, formatSimpleDividerLabel } from '@shared/utils';
import { flattenItemsForDisplay } from '@shared/utils/playerItemsUtils';

interface PlaylistViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
}) => {
  const {
    name,
    items,
    selectedItemIds,
    setName,
    removeItem,
    addItems,
    toggleItemSelection,
    selectAll,
    deselectAll,
    removeSelectedItems,
    selectRange,
    updateTrackDuration,
    getAllTracksInOrder,
    createGroup,
    ungroupGroup,
    setGroupName,
    newProject,
    undo,
    redo,
  } = useProjectStore();

  // Flatten items for display (supports groups)
  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);

  // Get flat list of tracks for duration loading and dividers
  const tracks = useMemo(() => getAllTracksInOrder(items), [getAllTracksInOrder, items]);

  const resolveTrackByPath = useCallback(
    (path: string) => tracks.find((track) => track.path === path),
    [tracks],
  );

  const { loadDurationsForTracks } = useTrackDuration({
    tracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackByPath,
    onDurationResolved: updateTrackDuration,
  });

  // Use unified playback preview hook
  const { activeTrackId, playerStatus, startPlayback, pausePlayback } = usePlaybackPreview({
    workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
  });

  // Use unified selection with modifiers hook
  const { handleToggleSelect } = useSelectionWithModifiers({
    toggleSelection: toggleItemSelection,
    selectRange,
  });

  // Adapters for drag and drop
  const handleAddTracks = useCallback(
    (newTracks: Omit<Track, 'id'>[]) => {
      addItems(newTracks);
    },
    [addItems],
  );

  const handleAddTracksAt = useCallback(
    (newTracks: Omit<Track, 'id'>[], index: number) => {
      addItems(newTracks, index);
    },
    [addItems],
  );

  // Cross-workspace drag-drop executor
  const { executeMove, executeCopy } = useDragDropExecutor();
  const addNotification = useUIStore((state) => state.addNotification);

  const handleError = useCallback(
    (message: string) => {
      addNotification({ type: 'error', message, duration: 5000 });
    },
    [addNotification],
  );

  const playlistDrag = useWorkspaceDragAndDrop({
    displayItems,
    items,
    tracks,
    selectedItemIds,
    workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
    isValidAudioFile: fileService.isValidAudioFile.bind(fileService),
    onAddTracks: handleAddTracks,
    onAddTracksAt: handleAddTracksAt,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: ipcService.findAudioFilesRecursive.bind(ipcService),
    // Unified move/copy executors (handles both same-workspace and cross-workspace)
    onMove: executeMove,
    onCopy: executeCopy,
    onError: handleError,
  });

  const { hourDividerInterval, showHourDividers } = useSettingsStore();

  // Calculate divider positions
  const calculateDividerMarkers = useMemo(
    () => calculateSimpleDividerMarkers(tracks, hourDividerInterval),
    [tracks, hourDividerInterval],
  );

  // Format divider label
  const formatDividerLabel = useCallback(
    (index: number): string => formatSimpleDividerLabel(tracks, index),
    [tracks],
  );

  const hasSelectedItems = selectedItemIds.size > 0;

  // Calculate total duration
  const totalDuration = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
    [tracks],
  );

  // Check if can create group (need 2+ consecutive selected items)
  const canCreateGroup = useMemo(() => {
    if (selectedItemIds.size < 2) return false;
    // Check if selected items are consecutive at root level
    const selectedIndices: number[] = [];
    items.forEach((item, index) => {
      if (selectedItemIds.has(item.id)) {
        selectedIndices.push(index);
      }
    });
    if (selectedIndices.length < 2) return false;
    // Check if consecutive
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        return false;
      }
    }
    return true;
  }, [selectedItemIds, items]);

  // Handle create group
  const handleCreateGroup = useCallback(() => {
    if (!canCreateGroup) return;
    const selectedIds = Array.from(selectedItemIds);
    try {
      createGroup(selectedIds);
      deselectAll();
    } catch (error) {
      logger.error('Failed to create group', error);
    }
  }, [canCreateGroup, selectedItemIds, createGroup, deselectAll]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    if (tracks.length === 0) return;
    newProject();
  }, [tracks.length, newProject]);

  // Keyboard shortcuts for list operations
  useListShortcuts({
    'list.undo': undo,
    'list.redo': redo,
    'list.delete': hasSelectedItems ? removeSelectedItems : undefined,
    'list.selectAll': selectAll,
    'list.escape': deselectAll,
  });

  // Get track index in the flat track list (for dividers)
  const getTrackIndexInFlatList = useCallback(
    (trackId: string): number => {
      return tracks.findIndex((t) => t.id === trackId);
    },
    [tracks],
  );

  return (
    <div className="playlist-view">
      <WorkspaceHeader
        name={name}
        onNameChange={setName}
        itemCount={tracks.length}
        totalDuration={totalDuration}
        placeholder="Название проекта"
        hasSelectedItems={hasSelectedItems}
        selectedCount={selectedItemIds.size}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onRemoveSelected={removeSelectedItems}
        canCreateGroup={canCreateGroup}
        onCreateGroup={handleCreateGroup}
        onClearAll={handleClearAll}
      />

      <ItemList
        className="playlist-tracks"
        workspaceId={DEFAULT_PLAYLIST_WORKSPACE_ID}
        onDragOver={playlistDrag.handleDragOverContainer}
        onDragLeave={playlistDrag.handleDragLeave}
        onDragEnd={playlistDrag.handleDragEnd}
        onDrop={playlistDrag.handleDropOnContainer}
        emptyState={<EmptyState message="Project is empty" hint="Add tracks to get started" />}
      >
        {displayItems.map((displayItem) => {
          const { item, level, flatIndex } = displayItem;
          const isTrack = isProjectTrack(item);
          const track = isTrack ? item : null;
          const trackIndex = track ? getTrackIndexInFlatList(track.id) : -1;

          const isDraggedItem =
            isItemDragState(playlistDrag.draggedItems) &&
            playlistDrag.draggedItems.allFlatIndices.has(flatIndex);
          const isActive = track ? activeTrackId === track.id : false;
          const isPlaying = isActive && playerStatus === 'playing';
          const showDivider = isTrack && trackIndex >= 0 && calculateDividerMarkers.includes(trackIndex);

          return (
            <React.Fragment key={item.id}>
              <DropIndicator index={flatIndex} />
              <ProjectItemRow
                item={item}
                index={displayItem.displayIndex}
                listIndex={flatIndex}
                level={level}
                mode="playlist"
                isSelected={selectedItemIds.has(item.id)}
                isDragging={isDraggedItem}
                isDragOver={playlistDrag.dragOverIndex === flatIndex && !isDraggedItem}
                insertPosition={
                  playlistDrag.dragOverIndex === flatIndex && !isDraggedItem
                    ? playlistDrag.insertPosition
                    : null
                }
                isActive={isActive}
                isPlaying={isPlaying}
                onToggleSelect={handleToggleSelect}
                onRemove={removeItem}
                onDragStart={(e) => playlistDrag.handleDragStart(e, item.id)}
                onDragOver={(e) => playlistDrag.handleDragOver(e, flatIndex)}
                onDrop={(e) => playlistDrag.handleDrop(e, flatIndex)}
                onDragEnd={playlistDrag.handleDragEnd}
                onPlay={startPlayback}
                onPause={pausePlayback}
                onRenameGroup={setGroupName}
                onUngroupGroup={ungroupGroup}
              />
              {/* Hour divider after track */}
              {showHourDividers && showDivider && (
                <div className="playlist-hour-divider">
                  <span className="playlist-hour-divider-label">
                    {formatDividerLabel(trackIndex)}
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <DropIndicator index={displayItems.length} />
      </ItemList>
    </div>
  );
};
