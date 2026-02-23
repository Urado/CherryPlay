import * as signalR from '@microsoft/signalr';
import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectGroup } from '@core/types/project';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { useWorkspaceDragAndDrop, useTrackDuration, useDragDropExecutor } from '@shared/hooks';
import { fileService, ipcService, signalRService } from '@shared/services';
import { partyService } from '@shared/services/partyService';
import { useUIStore, useSettingsStore, usePartyStore, useProjectStore } from '@shared/stores';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { logger } from '@shared/utils';
import { flattenItemsForDisplay, getTracksFromDisplayItems } from '@shared/utils/playerItemsUtils';
import { createTrackWithId } from '@shared/utils/trackFactory';

import { usePlayerDividers } from '../hooks/usePlayerDividers';
import { usePlayerPlayback } from '../hooks/usePlayerPlayback';
import { usePlayerSession } from '../hooks/usePlayerSession';
import { usePlayerStateHelpers } from '../hooks/usePlayerStateHelpers';
import { PlayerView } from '../PlayerView';
import {
  isTrackOrGroupDisabled as isTrackOrGroupDisabledUtil,
  isTrackActive as isTrackActiveUtil,
  markSkippedDisabledTracks as markSkippedDisabledTracksUtil,
  canRemoveSelectedItems as canRemoveSelectedItemsUtil,
  areItemsConsecutive as areItemsConsecutiveUtil,
} from '../utils/playerStateUtils';

interface PlayerViewContainerProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlayerViewContainer: React.FC<PlayerViewContainerProps> = ({
  workspaceId: _workspaceId,
  zoneId,
}) => {
  const {
    name,
    items,
    selectedItemIds,
    settings,
    sessionState,
    setName,
    removeItem,
    addItem,
    toggleItemSelection,
    selectAll,
    deselectAll,
    removeSelectedItems,
    selectRange,
    getAllTracksInOrder,
    getItemPath,
    createGroup,
    findItemById,
    updateTrackDuration,
    setGroupName,
    ungroupGroup,
    markTrackAsPlayed,
    setCurrentTrack,
    isTrackPlayed,
    toggleTrackDisabled,
    isTrackDisabled,
    toggleGroupDisabled,
    isGroupDisabled,
  } = useProjectStore();

  const { plannedEndTime } = settings;
  const mode = sessionState.mode;

  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);

  const allTracks = useMemo(() => {
    return getTracksFromDisplayItems(displayItems);
  }, [displayItems]);

  const resolveTrackById = useCallback(
    (id: string) => allTracks.find((track) => track.id === id),
    [allTracks],
  );

  const { loadDurationsForTracks } = useTrackDuration({
    tracks: allTracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackById,
    onDurationResolved: updateTrackDuration,
  });

  const handleAddTracks = useCallback(
    (newTracks: Omit<Track, 'id'>[]) => {
      const tracksWithIds = newTracks.map(createTrackWithId);
      tracksWithIds.forEach((track) => addItem(track));
      const targetList = tracksWithIds.map((t) => ({ id: t.id, path: t.path }));
      loadDurationsForTracks(targetList);
    },
    [addItem, loadDurationsForTracks],
  );

  const handleAddTracksAt = useCallback(
    (newTracks: Omit<Track, 'id'>[], index: number) => {
      const tracksWithIds = newTracks.map(createTrackWithId);
      tracksWithIds.forEach((track, i) => addItem(track, index + i));
      const targetList = tracksWithIds.map((t) => ({ id: t.id, path: t.path }));
      loadDurationsForTracks(targetList);
    },
    [addItem, loadDurationsForTracks],
  );

  const { executeMove, executeCopy } = useDragDropExecutor();
  const addNotification = useUIStore((state) => state.addNotification);

  const handleError = useCallback(
    (message: string) => {
      addNotification({ type: 'error', message, duration: 5000 });
    },
    [addNotification],
  );

  const playerDrag = useWorkspaceDragAndDrop({
    displayItems,
    items,
    tracks: allTracks,
    selectedItemIds,
    workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
    isValidAudioFile: fileService.isValidAudioFile.bind(fileService),
    onAddTracks: handleAddTracks,
    onAddTracksAt: handleAddTracksAt,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: ipcService.findAudioFilesRecursive.bind(ipcService),
    onMove: executeMove,
    onCopy: executeCopy,
    onError: handleError,
  });

  const { createdParty } = usePartyStore((state) => ({ createdParty: state.createdParty }));
  const [connectionState, setConnectionState] = useState<signalR.HubConnectionState | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disabledTracksKey = sessionState.disabledTrackIds.join(',');
  const disabledGroupsKey = sessionState.disabledGroupIds.join(',');
  const playedTracksKey = sessionState.playedTrackIds.join(',');

  const isPreparationMode = mode === 'preparation';

  const { showHourDividers, enableStreaming } = useSettingsStore();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isTrackDisabled,
      isGroupDisabled,
      getItemPath,
      findItemById,
      disabledTracksKey,
      disabledGroupsKey,
    ],
  );

  const isTrackActive = useCallback(
    (trackId: string): boolean => {
      return isTrackActiveUtil(trackId, isTrackPlayed, isTrackOrGroupDisabled);
    },
    [isTrackPlayed, isTrackOrGroupDisabled],
  );

  const { position: currentTrackPosition, currentTrack: activePlayerTrack } = usePlayerAudioStore();
  const activePlayerTrackId = activePlayerTrack?.id;

  const openTrackSettingsModal = useUIStore((state) => state.openTrackSettingsModal);

  const handleOpenTrackSettings = useCallback(
    (itemId: string) => {
      const item = findItemById(itemId);
      if (item) {
        if (isProjectGroup(item)) {
          openTrackSettingsModal({ trackId: null, groupId: itemId, isGlobal: false });
        } else {
          openTrackSettingsModal({ trackId: itemId, groupId: null, isGlobal: false });
        }
      }
    },
    [openTrackSettingsModal, findItemById],
  );

  const handleOpenGlobalSettings = useCallback(() => {
    openTrackSettingsModal({ trackId: null, groupId: null, isGlobal: true });
  }, [openTrackSettingsModal]);

  const { getEffectiveTrackSettings, getNextActiveTrack } = usePlayerStateHelpers({
    allTracks,
    activePlayerTrackId,
    getItemPath,
    findItemById,
    isTrackActive,
  });

  const markSkippedDisabledTracks = useCallback(
    (fromIndex: number, toIndex: number) => {
      markSkippedDisabledTracksUtil(
        fromIndex,
        toIndex,
        allTracks,
        isTrackOrGroupDisabled,
        isTrackPlayed,
        markTrackAsPlayed,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      allTracks,
      isTrackOrGroupDisabled,
      isTrackPlayed,
      markTrackAsPlayed,
      disabledTracksKey,
      disabledGroupsKey,
      playedTracksKey,
    ],
  );

  const { startTrackPlayback, pausePlayback, handleNext, activeTrackId, playerStatus } =
    usePlayerPlayback({
      allTracks,
      getEffectiveTrackSettings,
      getNextActiveTrack,
      markTrackAsPlayed,
      markSkippedDisabledTracks,
      setCurrentTrack,
    });

  const { handleStartSession, handleResetSession } = usePlayerSession({
    allTracks,
    isTrackActive,
  });

  const {
    calculateDividerMarkers,
    formatDividerLabel,
    projectedEndTime,
    formatProjectedEndTime,
    formatPlannedEndTimeLabel,
    formatPlannedEndMarkerTime,
    plannedEndDividerPosition,
  } = usePlayerDividers({
    allTracks,
    activePlayerTrackId,
    currentTrackPosition,
    isTrackOrGroupDisabled,
    isTrackPlayed,
    getEffectiveTrackSettings,
    displayItems,
  });

  const handleToggleDisabled = useCallback(
    (itemId: string) => {
      // Запрещаем отключение текущего трека
      if (itemId === activePlayerTrackId) {
        return;
      }
      const item = findItemById(itemId);
      if (item) {
        if (isProjectGroup(item)) {
          toggleGroupDisabled(itemId);
        } else {
          toggleTrackDisabled(itemId);
        }
      }
    },
    [activePlayerTrackId, toggleTrackDisabled, toggleGroupDisabled, findItemById],
  );

  const handleUngroupGroup = useCallback(
    (groupId: string) => {
      if (isPreparationMode) {
        try {
          ungroupGroup(groupId);
        } catch (error) {
          logger.error('Failed to ungroup group', error);
        }
      } else {
        const item = findItemById(groupId);
        if (item && isProjectGroup(item)) {
          const groupTracks = getAllTracksInOrder([item]);
          const hasPlayedOrCurrent = groupTracks.some(
            (track) => isTrackPlayed(track.id) || track.id === activePlayerTrackId,
          );
          if (!hasPlayedOrCurrent) {
            try {
              ungroupGroup(groupId);
            } catch (error) {
              logger.error('Failed to ungroup group', error);
            }
          }
        }
      }
    },
    [
      isPreparationMode,
      ungroupGroup,
      findItemById,
      getAllTracksInOrder,
      isTrackPlayed,
      activePlayerTrackId,
    ],
  );

  const handleExportTracksToText = useCallback(() => {
    try {
      const allTracksInOrder = getAllTracksInOrder(items);

      if (allTracksInOrder.length === 0) {
        return;
      }

      const trackNames = allTracksInOrder.map((track) => track.name);
      const fileContent = trackNames.join('\n');
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name || 'tracks'}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export tracks to text file', error);
    }
  }, [items, getAllTracksInOrder, name]);

  const hasSelectedItems = selectedItemIds.size > 0;

  const canRemoveSelectedItems = useMemo(() => {
    return canRemoveSelectedItemsUtil(
      selectedItemIds,
      isPreparationMode,
      activePlayerTrackId,
      findItemById,
      isTrackPlayed,
      getAllTracksInOrder,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPreparationMode,
    selectedItemIds,
    findItemById,
    isTrackPlayed,
    activePlayerTrackId,
    getAllTracksInOrder,
    playedTracksKey,
  ]);

  const handleRemoveSelectedItems = useCallback(() => {
    if (!canRemoveSelectedItems) {
      return;
    }
    removeSelectedItems();
  }, [canRemoveSelectedItems, removeSelectedItems]);

  const totalDuration = useMemo(() => {
    let total = 0;
    for (let i = 0; i < allTracks.length; i++) {
      const track = allTracks[i];
      if (isTrackOrGroupDisabled(track.id)) {
        continue;
      }
      total += track.duration || 0;
      if (i < allTracks.length - 1) {
        const trackSettings = getEffectiveTrackSettings(track.id);
        if (trackSettings.actionAfterTrack === 'pauseAndNext') {
          total += trackSettings.pauseBetweenTracks;
        }
      }
    }
    return total;
  }, [allTracks, isTrackOrGroupDisabled, getEffectiveTrackSettings]);

  const areItemsConsecutive = useCallback(
    (itemIds: string[]): boolean => {
      return areItemsConsecutiveUtil(itemIds, items, getItemPath, findItemById);
    },
    [getItemPath, findItemById, items],
  );

  const canCreateGroup = useMemo(() => {
    if (selectedItemIds.size < 2) return false;
    return areItemsConsecutive(Array.from(selectedItemIds));
  }, [selectedItemIds, areItemsConsecutive]);

  const handleCreateGroup = useCallback(() => {
    if (selectedItemIds.size < 2) return;

    const selectedIds = Array.from(selectedItemIds);
    if (!areItemsConsecutive(selectedIds)) return;

    try {
      createGroup(selectedIds);
      deselectAll();
    } catch (error) {
      logger.error('Failed to create group', error);
    }
  }, [selectedItemIds, areItemsConsecutive, createGroup, deselectAll]);

  useEffect(() => {
    if (!enableStreaming) {
      if (signalRService.isServiceConnected()) {
        signalRService.disconnect().catch(console.error);
      }
      setConnectionState(null);
      return;
    }

    if (!createdParty) {
      if (signalRService.isServiceConnected()) {
        signalRService.disconnect().catch(console.error);
      }
      setConnectionState(null);
      return;
    }

    const connectToSignalR = async () => {
      if (!createdParty || !enableStreaming) {
        return;
      }

      try {
        const exists = await partyService.checkPartyExists(createdParty.id);
        if (!exists) {
          console.warn(
            '[PlayerViewContainer] Party does not exist on server, skipping SignalR connection',
          );
          setConnectionState(signalR.HubConnectionState.Disconnected);
          return;
        }
      } catch (error) {
        console.error('[PlayerViewContainer] Failed to check party existence:', error);
        setConnectionState(signalR.HubConnectionState.Disconnected);
        return;
      }

      if (signalRService.isServiceConnected()) {
        setConnectionState(signalR.HubConnectionState.Connected);
        signalRService.startStoreSubscriptions(createdParty.id);
        if (mode === 'session') {
          signalRService.startPositionUpdates(createdParty.id);
        }
        return;
      }

      try {
        setConnectionState(signalR.HubConnectionState.Connecting);
        await signalRService.connect();
        await signalRService.joinPartyAsOrganizer(createdParty.id);
        signalRService.startStoreSubscriptions(createdParty.id);

        if (mode === 'session') {
          signalRService.startPositionUpdates(createdParty.id);
          await signalRService.startSession(createdParty.id);
        }

        signalRService.sendFullStateUpdate(createdParty.id);
        setConnectionState(signalR.HubConnectionState.Connected);
      } catch (error) {
        console.error('[PlayerViewContainer] Failed to connect to SignalR:', error);
        setConnectionState(signalR.HubConnectionState.Disconnected);

        if (createdParty && reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (createdParty && enableStreaming) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectToSignalR();
          }, 10000);
        }
      }
    };

    connectToSignalR();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [createdParty, mode, enableStreaming]);

  useEffect(() => {
    if (!enableStreaming || !createdParty || !signalRService.isServiceConnected()) {
      return;
    }

    if (mode === 'session') {
      signalRService.startPositionUpdates(createdParty.id);
      signalRService.startSession(createdParty.id).catch(console.error);
    } else {
      signalRService.stopPositionUpdates();
    }
  }, [mode, createdParty, enableStreaming]);

  useEffect(() => {
    if (!enableStreaming) {
      setConnectionState(null);
      return;
    }

    const interval = setInterval(() => {
      const state = signalRService.getConnectionState();
      setConnectionState(state);
    }, 1000);

    return () => clearInterval(interval);
  }, [enableStreaming]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <PlayerView
      name={name}
      onNameChange={setName}
      allTracksCount={allTracks.length}
      totalDuration={totalDuration}
      projectedEndTime={projectedEndTime !== null ? formatProjectedEndTime() : null}
      hasSelectedItems={hasSelectedItems}
      canCreateGroup={canCreateGroup}
      canRemoveSelectedItems={canRemoveSelectedItems}
      selectedItemsCount={selectedItemIds.size}
      isPreparationMode={isPreparationMode}
      onDeselectAll={deselectAll}
      onCreateGroup={handleCreateGroup}
      onRemoveSelectedItems={handleRemoveSelectedItems}
      onSelectAll={selectAll}
      onStartSession={handleStartSession}
      onResetSession={handleResetSession}
      onOpenGlobalSettings={handleOpenGlobalSettings}
      onExportTracksToText={handleExportTracksToText}
      displayItems={displayItems}
      zoneId={zoneId}
      selectedItemIds={selectedItemIds}
      activeTrackId={activeTrackId}
      activePlayerTrackId={activePlayerTrackId}
      playerStatus={playerStatus}
      mode={mode}
      showHourDividers={showHourDividers}
      plannedEndTime={plannedEndTime}
      plannedEndDividerPosition={plannedEndDividerPosition}
      calculateDividerMarkers={calculateDividerMarkers}
      playerDrag={playerDrag}
      getAllTracksInOrder={getAllTracksInOrder}
      isTrackPlayed={isTrackPlayed}
      isGroupDisabled={isGroupDisabled}
      isTrackOrGroupDisabled={isTrackOrGroupDisabled}
      getEffectiveTrackSettings={getEffectiveTrackSettings}
      formatDividerLabel={formatDividerLabel}
      formatPlannedEndTimeLabel={formatPlannedEndTimeLabel}
      formatPlannedEndMarkerTime={formatPlannedEndMarkerTime}
      toggleItemSelection={toggleItemSelection}
      selectRange={selectRange}
      removeItem={removeItem}
      setGroupName={setGroupName}
      handleToggleDisabled={handleToggleDisabled}
      handleUngroupGroup={handleUngroupGroup}
      handleOpenTrackSettings={handleOpenTrackSettings}
      startTrackPlayback={startTrackPlayback}
      pausePlayback={pausePlayback}
      onNext={handleNext}
      connectionState={connectionState}
    />
  );
};
