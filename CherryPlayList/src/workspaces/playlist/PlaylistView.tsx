import React, { useCallback, useMemo } from 'react';

import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import {
  ItemList,
  DropIndicator,
  ProjectItemRow,
  EmptyState,
  WorkspaceHeader,
  HourDividerAfterTrackRow,
  HourDividerListBottom,
} from '@shared/components';
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
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { logger, getDuplicateTrackIdsByPathAndFilename } from '@shared/utils';
import { flattenItemsForDisplay, getTracksFromDisplayItems } from '@shared/utils/playerItemsUtils';

import { usePlayerDividers } from '../player/hooks/usePlayerDividers';
import { usePlayerMode } from '../player/hooks/usePlayerMode';
import { usePlayerStateHelpers } from '../player/hooks/usePlayerStateHelpers';
import {
  isTrackActive as isTrackActiveUtil,
  isTrackOrGroupDisabled as isTrackOrGroupDisabledUtil,
} from '../player/utils/playerStateUtils';

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
    settings,
    sessionState,
    setName,
    removeItem,
    addItems,
    toggleItemSelection,
    selectAll,
    deselectAll,
    removeSelectedItems,
    selectRange,
    updateTrackDuration,
    getItemPath,
    findItemById,
    createGroup,
    ungroupGroup,
    setGroupName,
    newProject,
    undo,
    redo,
    isTrackPlayed,
    isTrackDisabled,
    isGroupDisabled,
  } = useProjectStore();

  const { plannedEndTime } = settings;
  const isPreparationMode = sessionState.mode === 'preparation';
  const disabledTracksKey = sessionState.disabledTrackIds.join(',');
  const disabledGroupsKey = sessionState.disabledGroupIds.join(',');

  // Flatten items for display (supports groups)
  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);

  // Flat track order aligned with on-screen list (for dividers, same as player)
  const tracks = useMemo(() => getTracksFromDisplayItems(displayItems), [displayItems]);

  const duplicateTrackIds = useMemo(() => getDuplicateTrackIdsByPathAndFilename(tracks), [tracks]);

  const resolveTrackById = useCallback(
    (id: string) => tracks.find((track) => track.id === id),
    [tracks],
  );

  const { loadDurationsForTracks } = useTrackDuration({
    tracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackById,
    onDurationResolved: updateTrackDuration,
  });

  // Use unified playback preview hook
  const { startPlayback, pausePlayback } = usePlaybackPreview({
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

  const { showHourDividers } = useSettingsStore();

  const isTrackOrGroupDisabled = useCallback(
    (itemId: string): boolean => {
      return isTrackOrGroupDisabledUtil(
        itemId,
        isTrackDisabled,
        isGroupDisabled,
        getItemPath,
        findItemById,
      );
    },
    [isTrackDisabled, isGroupDisabled, getItemPath, findItemById],
  );

  const isTrackActive = useCallback(
    (trackId: string): boolean => {
      return isTrackActiveUtil(trackId, isTrackPlayed, isTrackOrGroupDisabled);
    },
    [isTrackPlayed, isTrackOrGroupDisabled],
  );

  const playerMode = usePlayerMode();
  const { position: currentTrackPosition, currentTrack: activePlayerFromAudio } =
    usePlayerAudioStore();
  const activePlayerTrackId = activePlayerFromAudio?.id;

  const activeTrackIdForDividers = isPreparationMode
    ? playerMode.currentTrack?.id
    : activePlayerTrackId;

  const { getEffectiveTrackSettings } = usePlayerStateHelpers({
    allTracks: tracks,
    activePlayerTrackId: activeTrackIdForDividers,
    getItemPath,
    findItemById,
    isTrackActive,
  });

  const {
    calculateDividerMarkers,
    formatPlannedEndTimelineLabel,
    formatDividerLabel,
    plannedEndDividerPosition,
    queueEndDividerPosition,
    formatQueueEndTimelineLabel,
    showQueueEndDividerAtListBottom,
  } = usePlayerDividers({
    allTracks: tracks,
    activePlayerTrackId: activeTrackIdForDividers,
    currentTrackPosition,
    isTrackOrGroupDisabled,
    isTrackPlayed,
    getEffectiveTrackSettings,
    displayItems,
  });

  const showPlannedEndDividerAtListBottom =
    !isPreparationMode && plannedEndTime !== null && plannedEndDividerPosition === null;

  // Интервальные отсечки: те же calculateDividerMarkers / formatDividerLabel, что и в плеере
  // (таймлайн сессии, паузы, disabled), а не наивная сумма длительностей — см. usePlayerDividers.

  const hasSelectedItems = selectedItemIds.size > 0;

  // Total duration aligned with player header: skip disabled tracks, include pause-between gaps.
  const totalDuration = useMemo(() => {
    let total = 0;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (isTrackOrGroupDisabled(track.id)) {
        continue;
      }
      total += track.duration || 0;
      if (i < tracks.length - 1) {
        const trackSettings = getEffectiveTrackSettings(track.id);
        if (trackSettings.actionAfterTrack === 'pauseAndNext') {
          total += trackSettings.pauseBetweenTracks;
        }
      }
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys invalidate when disabled sets change (zustand stable isTrackOrGroupDisabled)
  }, [
    tracks,
    isTrackOrGroupDisabled,
    getEffectiveTrackSettings,
    disabledTracksKey,
    disabledGroupsKey,
  ]);

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

          const isDraggedItem =
            isItemDragState(playlistDrag.draggedItems) &&
            playlistDrag.draggedItems.allFlatIndices.has(flatIndex);
          // Подсветка строки и делители: один источник «текущего трека» (демо в подготовке, аудио в сессии), не demo preview из другого workspace
          const isActive = track ? activeTrackIdForDividers === track.id : false;
          const isPlaying = isActive && playerMode.status === 'playing';

          const showPlannedEndDividerBeforeActive =
            !isPreparationMode &&
            plannedEndTime !== null &&
            plannedEndDividerPosition === -1 &&
            track !== null &&
            item.id === activeTrackIdForDividers;

          const hasPlannedEndDivider =
            !isPreparationMode &&
            plannedEndTime !== null &&
            plannedEndDividerPosition === flatIndex;
          const hasQueueEndDivider =
            showHourDividers &&
            queueEndDividerPosition !== null &&
            queueEndDividerPosition === flatIndex;
          const showDivider =
            showHourDividers && isTrack && track !== null && calculateDividerMarkers.has(track.id);

          return (
            <React.Fragment key={item.id}>
              <DropIndicator index={flatIndex} />
              {showPlannedEndDividerBeforeActive && (
                <div className="playlist-hour-divider playlist-hour-divider--planned-end">
                  <span className="playlist-hour-divider-label">
                    {formatPlannedEndTimelineLabel()}
                  </span>
                </div>
              )}
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
                isDuplicatePath={track ? duplicateTrackIds.has(track.id) : false}
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
              <HourDividerAfterTrackRow
                hasPlannedEndDivider={hasPlannedEndDivider}
                hasQueueEndDivider={hasQueueEndDivider}
                showIntervalDivider={showDivider && track !== null}
                intervalTrackId={track?.id}
                formatPlannedEndTimelineLabel={formatPlannedEndTimelineLabel}
                formatQueueEndTimelineLabel={formatQueueEndTimelineLabel}
                formatDividerLabel={formatDividerLabel}
              />
            </React.Fragment>
          );
        })}
        <DropIndicator index={displayItems.length} />
        <HourDividerListBottom
          showPlannedEndDividerAtListBottom={showPlannedEndDividerAtListBottom}
          displayItemsLength={displayItems.length}
          showQueueEndDividerAtListBottom={showQueueEndDividerAtListBottom}
          formatPlannedEndTimelineLabel={formatPlannedEndTimelineLabel}
          formatQueueEndTimelineLabel={formatQueueEndTimelineLabel}
        />
      </ItemList>
    </div>
  );
};
