import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProjectItem } from '@core/types/project';
import { WorkspaceId } from '@core/types/workspace';

import { isCrossWorkspaceOperation } from '../../core/constants/workspace';
import { Track } from '../../core/types/track';
import {
  getRootIdsForDrag,
  collectAllFlatIndices,
  isDropInsideDragged,
  calculateDropPosition,
  filterDisplayItems,
} from '../../modules/dragDrop/dropPositionUtils';
import { DragDropCommand, InsertPosition, ItemDragState } from '../../modules/dragDrop/types';
import { ipcService } from '../services/ipcService';
import { useDragDropStore, isItemDragState } from '../stores/dragDropStore';
import { getProjectStore } from '../stores/projectStoreFactory';
import { logger } from '../utils/logger';
import {
  classifyNativePathsWithStat,
  collectNativePathsFromDataTransfer,
  getPathForFileInRenderer,
  isOsNativeFileDataTransfer,
  tryParseInternalFileBrowserPayload,
} from '../utils/nativeDataTransferPaths';
import { DisplayItem } from '../utils/playerItemsUtils';
import { createTrackDrafts } from '../utils/trackFactory';

export interface WorkspaceDragDropOptions {
  displayItems: DisplayItem[];
  items: ProjectItem[];
  tracks: Track[];
  selectedItemIds: Set<string>;
  workspaceId: WorkspaceId;
  isValidAudioFile: (path: string) => boolean;
  onAddTracks: (tracks: Omit<Track, 'id'>[]) => void;
  onAddTracksAt: (tracks: Omit<Track, 'id'>[], index: number) => void;
  onTracksAdded?: (targets: Array<{ id: string; path: string }>) => void;
  loadFolderTracks?: (folderPath: string) => Promise<string[]>;
  /** Unified move executor - handles both same-workspace and cross-workspace moves */
  onMove?: (command: DragDropCommand) => boolean;
  /** Unified copy executor - handles both same-workspace and cross-workspace copies */
  onCopy?: (command: DragDropCommand) => boolean;
  onError?: (message: string) => void;
}

export type TrackWorkspaceDragOptions = WorkspaceDragDropOptions;
export type PlaylistDragOptions = WorkspaceDragDropOptions;

export function useWorkspaceDragAndDrop(options: WorkspaceDragDropOptions) {
  const {
    displayItems,
    items: _items,
    selectedItemIds,
    workspaceId,
    isValidAudioFile,
    onAddTracks,
    onAddTracksAt,
    onTracksAdded: _onTracksAdded,
    loadFolderTracks,
    onMove,
    onCopy,
    onError,
  } = options;

  const setDragging = useDragDropStore((state) => state.setDragging);
  const draggedItems = useDragDropStore((state) => state.draggedItems);
  const setDraggedItems = useDragDropStore((state) => state.setDraggedItems);
  const hoverWorkspaceId = useDragDropStore((state) => state.hoverWorkspaceId);
  const setHoverWorkspaceId = useDragDropStore((state) => state.setHoverWorkspaceId);
  const clearDragState = useDragDropStore((state) => state.clearDragState);
  const prepareMoveCommand = useDragDropStore((state) => state.prepareMoveCommand);
  const prepareCopyCommand = useDragDropStore((state) => state.prepareCopyCommand);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [insertPosition, setInsertPosition] = useState<InsertPosition | null>(null);

  const selectedIdsMemo = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  const clearIndicators = useCallback(() => {
    setDragOverIndex(null);
    setInsertPosition(null);
  }, []);

  useEffect(() => {
    if (hoverWorkspaceId !== null && hoverWorkspaceId !== workspaceId) {
      setTimeout(() => {
        clearIndicators();
      }, 0);
    }
  }, [hoverWorkspaceId, workspaceId, clearIndicators]);

  const handleClearDragState = useCallback(() => {
    clearDragState();
    clearIndicators();
  }, [clearDragState, clearIndicators]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string) => {
      const displayItem = displayItems.find((di) => di.item.id === itemId);
      if (!displayItem) {
        logger.warn('handleDragStart: item not found in displayItems', { itemId });
        return;
      }

      const rootIds = getRootIdsForDrag(itemId, selectedIdsMemo, displayItems);
      if (rootIds.length === 0) {
        logger.warn('handleDragStart: no root items to drag', { itemId });
        return;
      }

      const allFlatIndices = collectAllFlatIndices(rootIds, displayItems);

      const dragState: ItemDragState = {
        type: 'items',
        rootIds,
        allFlatIndices,
        sourceWorkspaceId: workspaceId,
      };

      setDraggedItems(dragState);
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', itemId);
      setDragging(true);
    },
    [selectedIdsMemo, setDragging, workspaceId, setDraggedItems, displayItems],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetFlatIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const types = Array.from(e.dataTransfer.types);
      const isFileDrag =
        types.includes('application/json') || isOsNativeFileDataTransfer(e.dataTransfer);
      const isItemDrag = types.includes('text/plain');

      if (hoverWorkspaceId !== workspaceId) {
        setHoverWorkspaceId(workspaceId);
      }

      const isCrossWorkspace =
        isItemDrag &&
        isItemDragState(draggedItems) &&
        isCrossWorkspaceOperation(draggedItems.sourceWorkspaceId, workspaceId);

      if (isCrossWorkspace && isItemDragState(draggedItems)) {
        const sourceStore = getProjectStore(draggedItems.sourceWorkspaceId);
        const targetStore = getProjectStore(workspaceId);
        if (!sourceStore || !targetStore) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }

      if (isFileDrag) {
        e.dataTransfer.dropEffect = 'copy';
        if (!draggedItems || draggedItems.type !== 'files') {
          setDraggedItems({ type: 'files', paths: [], directories: [] });
        }
      } else if (isItemDrag && isItemDragState(draggedItems)) {
        const isCopyMode = isCrossWorkspace && (e.ctrlKey || e.metaKey);
        if (isCopyMode !== (draggedItems.isCopyMode ?? false)) {
          setDraggedItems({ ...draggedItems, isCopyMode: isCopyMode || undefined });
        }
        e.dataTransfer.dropEffect = isCopyMode ? 'copy' : 'move';

        if (
          !isCrossWorkspace &&
          isDropInsideDragged(targetFlatIndex, draggedItems.allFlatIndices)
        ) {
          e.dataTransfer.dropEffect = 'none';
          clearIndicators();
          return;
        }
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const position: InsertPosition = y < rect.height / 2 ? 'top' : 'bottom';

      setDragOverIndex(targetFlatIndex);
      setInsertPosition(position);
    },
    [
      clearIndicators,
      draggedItems,
      workspaceId,
      setDraggedItems,
      hoverWorkspaceId,
      setHoverWorkspaceId,
    ],
  );

  const handleDragOverContainer = useCallback(
    (e: React.DragEvent, insertIndex?: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (hoverWorkspaceId !== workspaceId) {
        setHoverWorkspaceId(workspaceId);
      }

      const types = Array.from(e.dataTransfer.types);
      const isFileDrag =
        types.includes('application/json') || isOsNativeFileDataTransfer(e.dataTransfer);

      if (isFileDrag) {
        e.dataTransfer.dropEffect = 'copy';
        if (!draggedItems || draggedItems.type !== 'files') {
          setDraggedItems({ type: 'files', paths: [], directories: [] });
        }
      } else if (isItemDragState(draggedItems)) {
        const isCrossWorkspace = isCrossWorkspaceOperation(
          draggedItems.sourceWorkspaceId,
          workspaceId,
        );
        const isCopyMode = isCrossWorkspace && (e.ctrlKey || e.metaKey);
        e.dataTransfer.dropEffect = isCopyMode ? 'copy' : 'move';
      }

      const index =
        typeof insertIndex === 'number' && insertIndex >= 0 ? insertIndex : displayItems.length;
      setDragOverIndex(index);
      setInsertPosition('top');
    },
    [
      draggedItems,
      displayItems.length,
      hoverWorkspaceId,
      setDraggedItems,
      setHoverWorkspaceId,
      workspaceId,
    ],
  );

  const addTracksFromPaths = useCallback(
    (paths: string[], parentId: string | null, localIndex: number) => {
      const filteredPaths = paths.filter((path) => isValidAudioFile(path));
      if (filteredPaths.length === 0) {
        return;
      }

      const drafts = createTrackDrafts(filteredPaths);

      if (parentId === null) {
        onAddTracksAt(drafts, localIndex);
      } else {
        onAddTracks(drafts);
      }
      // Duration loading is done in the parent's onAddTracks/onAddTracksAt (with track ids)
    },
    [isValidAudioFile, onAddTracks, onAddTracksAt],
  );

  const addFolders = useCallback(
    async (folders: string[], parentId: string | null, localIndex: number) => {
      if (!loadFolderTracks || folders.length === 0) {
        return;
      }

      const aggregated: string[] = [];
      for (const folder of folders) {
        try {
          const paths = await loadFolderTracks(folder);
          aggregated.push(...paths);
        } catch (error) {
          logger.error(`Failed to read folder ${folder}`, error);
        }
      }

      if (aggregated.length === 0) {
        return;
      }

      addTracksFromPaths(aggregated, parentId, localIndex);
    },
    [addTracksFromPaths, loadFolderTracks],
  );

  const addTracksFromNativeDataTransfer = useCallback(
    async (dataTransfer: DataTransfer, parentId: string | null, localIndex: number) => {
      const raw = collectNativePathsFromDataTransfer(dataTransfer, getPathForFileInRenderer);
      if (raw.length === 0) {
        if (onError) {
          onError('Could not read paths for dropped files');
        }
        return;
      }

      const {
        files: filePaths,
        directories: directoryPaths,
        inputCount,
        statFailureCount,
      } = await classifyNativePathsWithStat(raw, (p) => ipcService.statFile(p, false));

      const anyClassified = filePaths.length > 0 || directoryPaths.length > 0;
      if (!anyClassified) {
        if (onError) {
          onError(
            statFailureCount > 0
              ? `Could not verify dropped items on disk (${statFailureCount} of ${inputCount} path(s) failed stat or validation).`
              : 'Could not verify dropped items on disk.',
          );
        }
        return;
      }

      if (filePaths.length) {
        addTracksFromPaths(filePaths, parentId, localIndex);
      }
      if (directoryPaths.length) {
        await addFolders(directoryPaths, parentId, localIndex);
      }

      if (statFailureCount > 0 && onError) {
        onError('Some dropped items could not be read and were skipped');
      }
    },
    [addFolders, addTracksFromPaths, onError],
  );

  const executeDrop = useCallback(
    (targetFlatIndex: number, position: InsertPosition) => {
      if (!isItemDragState(draggedItems)) {
        return;
      }

      const { rootIds, allFlatIndices, sourceWorkspaceId } = draggedItems;
      const isSameWorkspace = sourceWorkspaceId === workspaceId;

      if (isSameWorkspace && isDropInsideDragged(targetFlatIndex, allFlatIndices)) {
        logger.warn('executeDrop: cannot drop inside dragged items');
        return;
      }

      let targetDisplayItems: DisplayItem[];
      let adjustedTargetIndex = targetFlatIndex;

      if (isSameWorkspace) {
        targetDisplayItems = filterDisplayItems(displayItems, allFlatIndices);
        let countAbove = 0;
        for (const idx of allFlatIndices) {
          if (idx < targetFlatIndex) {
            countAbove++;
          }
        }
        adjustedTargetIndex = Math.max(0, targetFlatIndex - countAbove);
      } else {
        targetDisplayItems = displayItems;
      }

      const { parentId, localIndex } = calculateDropPosition(
        adjustedTargetIndex,
        position,
        targetDisplayItems,
      );

      // Unified execution path: always use prepareMoveCommand/prepareCopyCommand + executor
      const isCopyOperation = draggedItems.isCopyMode ?? false;
      const prepareCommand = isCopyOperation ? prepareCopyCommand : prepareMoveCommand;
      const executeCallback = isCopyOperation ? onCopy : onMove;

      const result = prepareCommand(rootIds, sourceWorkspaceId, workspaceId, parentId, localIndex);

      if (!result.success || !result.command) {
        if (result.error && onError) {
          onError(result.error);
        }
        return;
      }

      if (!executeCallback) {
        logger.warn('executeDrop: no executor callback provided');
        if (onError) {
          onError('Move/copy operation not supported');
        }
        return;
      }

      executeCallback(result.command);
    },
    [
      draggedItems,
      displayItems,
      workspaceId,
      prepareMoveCommand,
      prepareCopyCommand,
      onMove,
      onCopy,
      onError,
    ],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetFlatIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const currentPosition = insertPosition;
      const position = currentPosition ?? 'bottom';
      const { parentId, localIndex } = calculateDropPosition(
        targetFlatIndex,
        position,
        displayItems,
      );

      const internalPayload = tryParseInternalFileBrowserPayload(e.dataTransfer);
      if (internalPayload !== null) {
        const { files, directories } = internalPayload;
        if (files.length) {
          addTracksFromPaths(files, parentId, localIndex);
        }
        if (directories.length) {
          void addFolders(directories, parentId, localIndex);
        }
        handleClearDragState();
        return;
      }

      if (isOsNativeFileDataTransfer(e.dataTransfer)) {
        void (async () => {
          try {
            await addTracksFromNativeDataTransfer(e.dataTransfer, parentId, localIndex);
          } catch (err) {
            logger.error('Native file drop failed', err);
            if (onError) {
              onError(err instanceof Error ? err.message : 'Drop failed');
            }
          } finally {
            handleClearDragState();
          }
        })();
        return;
      }

      if (!draggedItems) {
        handleClearDragState();
        return;
      }

      if (isItemDragState(draggedItems) && currentPosition) {
        executeDrop(targetFlatIndex, currentPosition);
      }

      handleClearDragState();
    },
    [
      addFolders,
      addTracksFromPaths,
      addTracksFromNativeDataTransfer,
      handleClearDragState,
      executeDrop,
      draggedItems,
      insertPosition,
      displayItems,
      onError,
    ],
  );

  const handleDropOnContainer = useCallback(
    (e: React.DragEvent, insertIndex?: number) => {
      e.preventDefault();
      e.stopPropagation();

      const index =
        typeof insertIndex === 'number' && insertIndex >= 0 ? insertIndex : displayItems.length;

      const rootInsertIndex = displayItems.filter(
        (di, i) => i < index && di.parentGroupId === null,
      ).length;

      const internalPayload = tryParseInternalFileBrowserPayload(e.dataTransfer);
      if (internalPayload !== null) {
        const { files, directories } = internalPayload;
        if (files.length) {
          addTracksFromPaths(files, null, rootInsertIndex);
        }
        if (directories.length) {
          void addFolders(directories, null, rootInsertIndex);
        }
        handleClearDragState();
        return;
      }

      if (isOsNativeFileDataTransfer(e.dataTransfer)) {
        void (async () => {
          try {
            await addTracksFromNativeDataTransfer(e.dataTransfer, null, rootInsertIndex);
          } catch (err) {
            logger.error('Native file drop on container failed', err);
            if (onError) {
              onError(err instanceof Error ? err.message : 'Drop failed');
            }
          } finally {
            handleClearDragState();
          }
        })();
        return;
      }

      if (!draggedItems) {
        handleClearDragState();
        return;
      }

      if (isItemDragState(draggedItems)) {
        const position: InsertPosition = 'top';
        executeDrop(index, position);
      }

      handleClearDragState();
    },
    [
      addFolders,
      addTracksFromPaths,
      addTracksFromNativeDataTransfer,
      handleClearDragState,
      executeDrop,
      draggedItems,
      displayItems,
      onError,
    ],
  );

  const handleDragEnd = useCallback(() => {
    handleClearDragState();
  }, [handleClearDragState]);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      const currentTarget = e.currentTarget as HTMLElement;

      if (
        (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) &&
        (!relatedTarget || !currentTarget.contains(relatedTarget))
      ) {
        clearIndicators();
      }
    },
    [clearIndicators],
  );

  const dragOverId = useMemo(() => {
    if (dragOverIndex === null || dragOverIndex >= displayItems.length) {
      return null;
    }
    return displayItems[dragOverIndex]?.item.id ?? null;
  }, [dragOverIndex, displayItems]);

  return {
    draggedItems,
    dragOverId,
    dragOverIndex,
    insertPosition,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragOverContainer,
    handleDropOnContainer,
    handleDragEnd,
    handleDragLeave,
  };
}

export const useTrackWorkspaceDragAndDrop = useWorkspaceDragAndDrop;
export const usePlaylistDragAndDrop = useWorkspaceDragAndDrop;
