import FileDownloadIcon from '@mui/icons-material/FileDownload';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isProjectTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import {
  ItemList,
  DropIndicator,
  ProjectItemRow,
  EmptyState,
  WorkspaceHeader,
} from '@shared/components';
import {
  useWorkspaceDragAndDrop,
  useTrackDuration,
  usePlaybackPreview,
  useSelectionWithModifiers,
  useDragDropExecutor,
} from '@shared/hooks';
import { exportService, fileService, ipcService, playlistService } from '@shared/services';
import { useListShortcuts } from '@shared/shortcuts';
import {
  ensureProjectStore,
  useUIStore,
  useGlobalHistoryStore,
  ProjectStoreState,
} from '@shared/stores';
import { isItemDragState } from '@shared/stores/dragDropStore';
import { logger } from '@shared/utils';
import { flattenItemsForDisplay } from '@shared/utils/playerItemsUtils';

interface CollectionViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const CollectionView: React.FC<CollectionViewProps> = ({ workspaceId, zoneId: _zoneId }) => {
  // Create or get store for collection using the new projectStoreFactory
  const collectionStore = ensureProjectStore({
    workspaceId,
    initialName: 'New Collection',
    persist: true,
    supportsGroups: true, // Collections now support groups
    maxItems: null, // No limit
  });
  const collectionStoreRef = useRef(collectionStore);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    collectionStoreRef.current = collectionStore;
  }, [collectionStore]);

  // Get state from store
  const name = collectionStore((s: ProjectStoreState) => s.name);
  const items = collectionStore((s: ProjectStoreState) => s.items);
  const selectedItemIds = collectionStore((s: ProjectStoreState) => s.selectedItemIds);

  // Get actions from store
  const setName = collectionStore((s: ProjectStoreState) => s.setName);
  const removeItem = collectionStore((s: ProjectStoreState) => s.removeItem);
  const addItems = collectionStore((s: ProjectStoreState) => s.addItems);
  const toggleItemSelection = collectionStore((s: ProjectStoreState) => s.toggleItemSelection);
  const selectAll = collectionStore((s: ProjectStoreState) => s.selectAll);
  const deselectAll = collectionStore((s: ProjectStoreState) => s.deselectAll);
  const removeSelectedItems = collectionStore((s: ProjectStoreState) => s.removeSelectedItems);
  const selectRange = collectionStore((s: ProjectStoreState) => s.selectRange);
  const updateTrackDuration = collectionStore((s: ProjectStoreState) => s.updateTrackDuration);
  const createGroup = collectionStore((s: ProjectStoreState) => s.createGroup);
  const ungroupGroup = collectionStore((s: ProjectStoreState) => s.ungroupGroup);
  const setGroupName = collectionStore((s: ProjectStoreState) => s.setGroupName);
  const getAllTracksInOrder = collectionStore((s: ProjectStoreState) => s.getAllTracksInOrder);
  const clear = collectionStore((s: ProjectStoreState) => s.clear);

  // Global history for undo/redo
  const undo = useGlobalHistoryStore((s) => s.undo);
  const redo = useGlobalHistoryStore((s) => s.redo);

  // Flatten items for display (supports groups)
  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);

  // Get flat list of tracks for duration loading
  const tracks = useMemo(() => getAllTracksInOrder(items), [getAllTracksInOrder, items]);

  const duplicatePaths = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of tracks) count.set(t.path, (count.get(t.path) ?? 0) + 1);
    return new Set([...count.entries()].filter(([, c]) => c > 1).map(([p]) => p));
  }, [tracks]);

  const resolveTrackById = useCallback((id: string) => {
    const storeItems = collectionStoreRef.current.getState().items;
    return storeItems.filter(isProjectTrack).find((track: Track) => track.id === id);
  }, []);

  const { loadDurationsForTracks } = useTrackDuration({
    tracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackById,
    onDurationResolved: updateTrackDuration,
  });

  // Use unified playback preview hook
  const { activeTrackId, playerStatus, startPlayback, pausePlayback } = usePlaybackPreview({
    workspaceId,
  });

  // Use unified selection with modifiers hook
  const { handleToggleSelect } = useSelectionWithModifiers({
    toggleSelection: toggleItemSelection,
    selectRange,
  });

  const { addNotification } = useUIStore();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const getSafeFolderName = useCallback(() => {
    const fallback = 'Collection';
    const currentName = name;
    const trimmed = (currentName || fallback).trim();
    const sanitized = trimmed.replace(/[<>:"/\\|?*]+/g, '_');
    return sanitized.length === 0 ? fallback : sanitized;
  }, [name]);

  // Wrappers for compatibility with useWorkspaceDragAndDrop
  const addTracksWrapper = useCallback(
    (newTracks: Omit<Track, 'id'>[]) => addItems(newTracks),
    [addItems],
  );

  const addTracksAtWrapper = useCallback(
    (newTracks: Omit<Track, 'id'>[], index: number) => addItems(newTracks, index),
    [addItems],
  );

  // Cross-workspace drag-drop executor
  const { executeMove, executeCopy } = useDragDropExecutor();

  const handleError = useCallback(
    (message: string) => {
      addNotification({ type: 'error', message, duration: 5000 });
    },
    [addNotification],
  );

  const collectionDrag = useWorkspaceDragAndDrop({
    displayItems,
    items,
    tracks,
    selectedItemIds,
    workspaceId,
    isValidAudioFile: fileService.isValidAudioFile.bind(fileService),
    onAddTracks: addTracksWrapper,
    onAddTracksAt: addTracksAtWrapper,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: ipcService.findAudioFilesRecursive.bind(ipcService),
    // Unified move/copy executors (handles both same-workspace and cross-workspace)
    onMove: executeMove,
    onCopy: executeCopy,
    onError: handleError,
  });

  // Keyboard shortcuts for list operations
  useListShortcuts({
    'list.undo': undo,
    'list.redo': redo,
    'list.delete': selectedItemIds.size > 0 ? removeSelectedItems : undefined,
    'list.selectAll': selectAll,
    'list.escape': deselectAll,
  });

  const hasSelectedTracks = selectedItemIds.size > 0;
  const totalDuration = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
    [tracks],
  );

  // Check if can create group (need 2+ consecutive selected items at root level)
  const canCreateGroup = useMemo(() => {
    if (selectedItemIds.size < 2) return false;
    const selectedIndices: number[] = [];
    items.forEach((item, index) => {
      if (selectedItemIds.has(item.id)) {
        selectedIndices.push(index);
      }
    });
    if (selectedIndices.length < 2) return false;
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
    clear();
  }, [tracks.length, clear]);

  useEffect(() => {
    if (!exportMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);

  const handleExportAsJSON = useCallback(async () => {
    setExportMenuOpen(false);
    const path = await ipcService.showSaveDialog({
      title: 'Экспортировать коллекцию',
      defaultPath: `${name}.json`,
      filters: [{ name: 'JSON файлы', extensions: ['json'] }],
    });

    if (!path) {
      return;
    }

    const playlistData = {
      name,
      tracks: tracks.map((track) => ({
        path: track.path,
        name: track.name,
        duration: track.duration,
      })),
    };
    await playlistService.savePlaylist(path, playlistData);
    addNotification({ type: 'success', message: 'Коллекция экспортирована в JSON' });
  }, [addNotification, name, tracks]);

  const handleCopyTracks = useCallback(async () => {
    setExportMenuOpen(false);
    const targetPath = await ipcService.showFolderDialog({
      title: 'Выберите папку для копирования треков',
    });

    if (!targetPath) {
      return;
    }

    const result = await exportService.copyTracksToFolder(tracks, targetPath, getSafeFolderName());
    if (result.failed.length === 0) {
      addNotification({
        type: 'success',
        message: `Треки скопированы в папку: ${result.folderPath}`,
      });
    } else {
      addNotification({
        type: 'warning',
        message: `Скопировано: ${result.successful.length}. Ошибок: ${result.failed.length}`,
      });
    }
  }, [addNotification, getSafeFolderName, tracks]);

  const toggleExportMenu = useCallback(() => {
    const tracksLength = tracks.length;
    if (tracksLength === 0) {
      addNotification({ type: 'warning', message: 'Коллекция пуста' });
      return;
    }
    setExportMenuOpen((prev) => !prev);
  }, [addNotification, tracks]);

  // Export button as extra action for WorkspaceHeader
  const exportButton = (
    <div className="collection-export-wrapper" ref={exportMenuRef}>
      <button
        onClick={toggleExportMenu}
        className="playlist-header-action-icon"
        title="Экспортировать коллекцию"
      >
        <FileDownloadIcon style={{ fontSize: '20px' }} />
      </button>
      {exportMenuOpen && (
        <div className="collection-export-menu">
          <button onClick={handleExportAsJSON}>Экспорт в JSON</button>
          <button onClick={handleCopyTracks}>Скопировать в папку</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="playlist-view">
      <WorkspaceHeader
        name={name}
        onNameChange={setName}
        itemCount={tracks.length}
        totalDuration={totalDuration}
        placeholder="Название коллекции"
        hasSelectedItems={hasSelectedTracks}
        selectedCount={selectedItemIds.size}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onRemoveSelected={removeSelectedItems}
        canCreateGroup={canCreateGroup}
        onCreateGroup={handleCreateGroup}
        onClearAll={handleClearAll}
        extraActions={tracks.length > 0 ? exportButton : undefined}
      />

      <ItemList
        className="playlist-tracks"
        workspaceId={workspaceId}
        onDragOver={collectionDrag.handleDragOverContainer}
        onDragLeave={collectionDrag.handleDragLeave}
        onDragEnd={collectionDrag.handleDragEnd}
        onDrop={collectionDrag.handleDropOnContainer}
        emptyState={<EmptyState message="Collection is empty" hint="Add tracks to get started" />}
      >
        {displayItems.map((displayItem) => {
          const { item, level, flatIndex } = displayItem;
          const isTrack = isProjectTrack(item);
          const track = isTrack ? item : null;

          const isDraggedItem =
            isItemDragState(collectionDrag.draggedItems) &&
            collectionDrag.draggedItems.allFlatIndices.has(flatIndex);
          const isActive = track ? activeTrackId === track.id : false;
          const isPlaying = isActive && playerStatus === 'playing';

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
                isDragOver={collectionDrag.dragOverIndex === flatIndex && !isDraggedItem}
                insertPosition={
                  collectionDrag.dragOverIndex === flatIndex && !isDraggedItem
                    ? collectionDrag.insertPosition
                    : null
                }
                isActive={isActive}
                isPlaying={isPlaying}
                isDuplicatePath={track ? duplicatePaths.has(track.path) : false}
                onToggleSelect={handleToggleSelect}
                onRemove={removeItem}
                onDragStart={(e) => collectionDrag.handleDragStart(e, item.id)}
                onDragOver={(e) => collectionDrag.handleDragOver(e, flatIndex)}
                onDrop={(e) => collectionDrag.handleDrop(e, flatIndex)}
                onDragEnd={collectionDrag.handleDragEnd}
                onPlay={startPlayback}
                onPause={pausePlayback}
                onRenameGroup={setGroupName}
                onUngroupGroup={ungroupGroup}
              />
            </React.Fragment>
          );
        })}
        <DropIndicator index={displayItems.length} />
      </ItemList>
    </div>
  );
};
