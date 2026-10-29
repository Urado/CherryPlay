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
import { getPlatformCapabilities } from '@shared/platform';
import {
  fileService,
  ipcService,
} from '@shared/services';
import { dialogService } from '@shared/services/dialogService';
import { useListShortcuts } from '@shared/shortcuts';
import {
  ensureCollectionWorkspaceStore,
  getProjectStore,
  useUIStore,
  useProjectStore,
  useGlobalHistoryStore,
  ProjectStoreState,
  type ProjectStore,
} from '@shared/stores';
import { isItemDragState } from '@shared/stores/dragDropStore';
import {
  logger,
  getDuplicateTrackIdsByPathAndFilename,
} from '@shared/utils';
import { flattenItemsForDisplay } from '@shared/utils/playerItemsUtils';
import { deleteCollectionAndReinitialize } from '@shared/utils/workspaceLifecycle';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CollectionPicker } from './CollectionPicker';

interface CollectionViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const CollectionView: React.FC<CollectionViewProps> = ({ workspaceId, zoneId }) => {
  const bindingState = useProjectStore((state) => ({
    collectionId: state.collectionBindings[workspaceId],
    collections: state.collections,
  }));
  const existingStore = getProjectStore(workspaceId);

  if (!bindingState.collectionId || !existingStore) {
    return <div className="collection-picker-loading">Подготовка подборки…</div>;
  }

  return (
    <CollectionWorkspaceView
      key={bindingState.collectionId}
      workspaceId={workspaceId}
      zoneId={zoneId}
      collectionId={bindingState.collectionId}
      collectionStore={existingStore}
    />
  );
};

interface CollectionWorkspaceViewProps extends CollectionViewProps {
  collectionId: string;
  collectionStore: ProjectStore;
}

const CollectionWorkspaceView: React.FC<CollectionWorkspaceViewProps> = ({
  workspaceId,
  collectionId,
  collectionStore,
}) => {
  const collectionStoreRef = useRef(collectionStore);
  const collections = useProjectStore((state) =>
    state.collections.map(({ id, name }) => ({ id, name })),
  );

  useEffect(() => {
    collectionStoreRef.current = collectionStore;
  }, [collectionStore]);

  const name = collectionStore((s: ProjectStoreState) => s.name);
  const items = collectionStore((s: ProjectStoreState) => s.items);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());

  const setName = collectionStore((s: ProjectStoreState) => s.setName);
  const removeItem = collectionStore((s: ProjectStoreState) => s.removeItem);
  const addItems = collectionStore((s: ProjectStoreState) => s.addItems);
  const addItemsToGroup = collectionStore((s: ProjectStoreState) => s.addItemsToGroup);
  const updateTrackDuration = collectionStore((s: ProjectStoreState) => s.updateTrackDuration);
  const canCreateGroupInStore = collectionStore((s: ProjectStoreState) => s.canCreateGroup);
  const createGroup = collectionStore((s: ProjectStoreState) => s.createGroup);
  const ungroupGroup = collectionStore((s: ProjectStoreState) => s.ungroupGroup);
  const setGroupName = collectionStore((s: ProjectStoreState) => s.setGroupName);
  const getAllTracksInOrder = collectionStore((s: ProjectStoreState) => s.getAllTracksInOrder);
  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);
  const tracks = useMemo(() => getAllTracksInOrder(items), [getAllTracksInOrder, items]);

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItemIds(new Set(displayItems.map(({ item }) => item.id)));
  }, [displayItems]);

  const deselectAll = useCallback(() => setSelectedItemIds(new Set()), []);

  const selectRange = useCallback((fromId: string, toId: string) => {
    const ids = displayItems.map(({ item }) => item.id);
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    setSelectedItemIds(new Set(ids.slice(start, end + 1)));
  }, [displayItems]);

  const removeSelectedItems = useCallback(() => {
    const selected = Array.from(selectedItemIds);
    setSelectedItemIds(new Set());
    collectionStore.getState().removeItemsWithHistory(selected);
  }, [collectionStore, selectedItemIds]);

  const undo = useGlobalHistoryStore((s) => s.undo);
  const redo = useGlobalHistoryStore((s) => s.redo);

  const duplicateTrackIds = useMemo(() => getDuplicateTrackIdsByPathAndFilename(tracks), [tracks]);

  const resolveTrackById = useCallback((id: string) => {
    const storeItems = collectionStoreRef.current.getState().items;
    return getAllTracksInOrder(storeItems).find((track) => track.id === id);
  }, [getAllTracksInOrder]);

  const { loadDurationsForTracks } = useTrackDuration({
    tracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackById,
    onDurationResolved: updateTrackDuration,
    enabled: getPlatformCapabilities().supportsNativeFileSystem,
  });

  const { activeTrackId, playerStatus, startPlayback, pausePlayback } = usePlaybackPreview({
    workspaceId,
  });

  const { handleToggleSelect } = useSelectionWithModifiers({
    toggleSelection: toggleItemSelection,
    selectRange,
  });

  const { addNotification } = useUIStore();
  const handleSelectCollection = useCallback((nextCollectionId: string) => {
    ensureCollectionWorkspaceStore(workspaceId, nextCollectionId);
    useProjectStore.getState().bindCollectionToWorkspace(workspaceId, nextCollectionId);
    setSelectedItemIds(new Set());
  }, [workspaceId]);
  const handleCreateCollection = useCallback(() => {
    const nextCollectionId = useProjectStore.getState().createCollection();
    ensureCollectionWorkspaceStore(workspaceId, nextCollectionId);
    useProjectStore.getState().bindCollectionToWorkspace(workspaceId, nextCollectionId);
    setSelectedItemIds(new Set());
  }, [workspaceId]);
  const handleDeleteCollection = useCallback(async (targetCollectionId: string) => {
    const targetCollection = useProjectStore.getState().collections.find(
      (collection) => collection.id === targetCollectionId,
    );
    if (!targetCollection) return;
    const accepted = await dialogService.confirm({
      title: 'Удалить подборку?',
      message: targetCollection.items.length > 0
        ? `Подборка «${targetCollection.name}» и все её треки будут удалены. Это действие нельзя отменить.`
        : `Подборка «${targetCollection.name}» будет удалена. Это действие нельзя отменить.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (accepted) deleteCollectionAndReinitialize(targetCollectionId);
  }, []);

  const addTracksWrapper = useCallback(
    (newTracks: Omit<Track, 'id'>[], parentId?: string | null, localIndex?: number) => {
      if (parentId) {
        const addedTracks = addItemsToGroup(parentId, newTracks, localIndex ?? 0);
        loadDurationsForTracks(addedTracks.map(({ id, path }) => ({ id, path })));
        return;
      }
      addItems(newTracks);
    },
    [addItems, addItemsToGroup, loadDurationsForTracks],
  );

  const addTracksAtWrapper = useCallback(
    (newTracks: Omit<Track, 'id'>[], index: number) => addItems(newTracks, index),
    [addItems],
  );

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
    onMove: executeMove,
    onCopy: executeCopy,
    onError: handleError,
  });

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

  const canCreateGroup = useMemo(() => {
    return canCreateGroupInStore(Array.from(selectedItemIds));
  }, [selectedItemIds, canCreateGroupInStore]);

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

  const handleClearAll = useCallback(() => {
    if (items.length === 0) return;
    collectionStore.getState().removeItemsWithHistory(items.map((item) => item.id));
    setSelectedItemIds(new Set());
  }, [collectionStore, items]);

  return (
    <div className="playlist-view">
      <WorkspaceHeader
        name={name}
        onNameChange={setName}
        className="collection-header"
        compactStats
        titleControl={(
          <CollectionPicker
            collectionId={collectionId}
            name={name}
            collections={collections}
            onSelect={handleSelectCollection}
            onCreate={handleCreateCollection}
            onRename={setName}
            onDelete={(targetCollectionId) => {
              void handleDeleteCollection(targetCollectionId);
            }}
          />
        )}
        itemCount={tracks.length}
        totalDuration={totalDuration}
        placeholder="Название подборки"
        hasSelectedItems={hasSelectedTracks}
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
                isDuplicatePath={track ? duplicateTrackIds.has(track.id) : false}
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
