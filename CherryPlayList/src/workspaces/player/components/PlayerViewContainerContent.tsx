import React, { useCallback, useMemo, useEffect, useState } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectGroup } from '@core/types/project';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { LoudnessScanProgressModal } from '@shared/components/loudness/LoudnessScanProgressModal';
import { useWorkspaceDragAndDrop, useTrackDuration, useDragDropExecutor } from '@shared/hooks';
import { getPlatformCapabilities } from '@shared/platform';
import { fileService, ipcService } from '@shared/services';
import { partyService } from '@shared/services/partyService';
import { useUIStore, useSettingsStore, useProjectStore } from '@shared/stores';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { streamingOrchestrator } from '@shared/streaming';
import { logger } from '@shared/utils';
import { flattenItemsForDisplay, getTracksFromDisplayItems } from '@shared/utils/playerItemsUtils';
import { createTrackWithId } from '@shared/utils/trackFactory';

import { useJumpToTrack } from '../hooks/useJumpToTrack';
import { useLoudnessScanFlow } from '../hooks/useLoudnessScanFlow';
import { usePlayerDividers } from '../hooks/usePlayerDividers';
import { usePlayerPlayback } from '../hooks/usePlayerPlayback';
import { usePlayerSession } from '../hooks/usePlayerSession';
import { usePlayerStateHelpers } from '../hooks/usePlayerStateHelpers';
import { useSessionRecovery } from '../hooks/useSessionRecovery';
import { PlayerView } from '../PlayerView';
import {
  isTrackOrGroupDisabled as isTrackOrGroupDisabledUtil,
  isTrackActive as isTrackActiveUtil,
  markSkippedDisabledTracks as markSkippedDisabledTracksUtil,
  canRemoveSelectedItems as canRemoveSelectedItemsUtil,
  areItemsConsecutive as areItemsConsecutiveUtil,
} from '../utils/playerStateUtils';

export interface PlayerViewContainerContentProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlayerViewContainerContent: React.FC<PlayerViewContainerContentProps> = ({
  workspaceId: _workspaceId,
  zoneId,
}) => {
  const {
    name,
    items,
    selectedItemIds,
    settings,
    sessionState,
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

  const linkedParty = useProjectStore((state) => state.meta?.linkedParty ?? null);

  const [serverTrackIds, setServerTrackIds] = useState<Set<string> | null>(null);

  const disabledTracksKey = sessionState.disabledTrackIds.join(',');
  const disabledGroupsKey = sessionState.disabledGroupIds.join(',');
  const playedTracksKey = sessionState.playedTrackIds.join(',');

  const isPreparationMode = mode === 'preparation';

  const { showHourDividers, enableStreaming, loudnessNormalizationEnabled } = useSettingsStore();
  const { scanState, cancelScan, ensureSessionGateReady, scanAllTracks } = useLoudnessScanFlow();

  const supportsLoudnessAnalysis = useMemo(() => {
    try {
      return getPlatformCapabilities().supportsLoudnessAnalysis;
    } catch {
      return false;
    }
  }, []);

  const showLoudnessBatchButton =
    isPreparationMode && loudnessNormalizationEnabled && supportsLoudnessAnalysis;
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

  const resolveFreshTracks = useCallback(
    (tracks: Track[]) =>
      tracks.map((track) => {
        const item = findItemById(track.id);
        return item && !isProjectGroup(item) ? item : track;
      }),
    [findItemById],
  );

  const beforeStartSession = useCallback(async () => {
    return ensureSessionGateReady(allTracks, isTrackActive, resolveFreshTracks);
  }, [allTracks, isTrackActive, ensureSessionGateReady, resolveFreshTracks]);

  const { handleStartSession, handleResetSession: handleResetSessionFromHook } = usePlayerSession({
    allTracks,
    isTrackActive,
    beforeStartSession,
  });

  const handleCalculateLoudness = useCallback(() => {
    if (allTracks.length === 0) {
      return;
    }
    void scanAllTracks(allTracks);
  }, [allTracks, scanAllTracks]);

  const handleResetSession = useCallback(async () => {
    if (enableStreaming && linkedParty) {
      try {
        await streamingOrchestrator.resetServerPlaybackState();
      } catch (error) {
        logger.error('[PlayerViewContainer] Failed to reset playback state on server', error);
        addNotification({
          type: 'error',
          message: 'Не удалось сбросить состояние воспроизведения на сервере',
          duration: 5000,
        });
        return;
      }
    }
    handleResetSessionFromHook();
    if (enableStreaming && linkedParty) {
      streamingOrchestrator.publishFullState();
    }
  }, [enableStreaming, linkedParty, handleResetSessionFromHook, addNotification]);

  useSessionRecovery();

  const { jumpToTrack } = useJumpToTrack();

  const {
    calculateDividerMarkers,
    formatDividerLabel,
    formatPlannedEndTimelineLabel,
    plannedEndDividerPosition,
    queueEndDividerPosition,
    formatQueueEndTimelineLabel,
    showQueueEndDividerAtListBottom,
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
    // isTrackOrGroupDisabled + disabled* keys: see usePlayerDividers (zustand stable refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys invalidate when disabled sets change
  }, [
    allTracks,
    isTrackOrGroupDisabled,
    getEffectiveTrackSettings,
    disabledTracksKey,
    disabledGroupsKey,
  ]);

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

  // Party metadata reads only (getPartyUrl, getPartyState) — no REST playlist PUT here.
  // Live playlist sync during session: Site Streamer `partyPlaylistSync` via orchestrator.
  useEffect(() => {
    const regenerateUrl = () => {
      const { linkedParty: party } = useProjectStore.getState().meta;
      if (party?.shortCode && !party.url) {
        partyService
          .getPartyUrl(party.shortCode)
          .then((url) => {
            useProjectStore
              .getState()
              .setLinkedParty({ id: party.id, shortCode: party.shortCode, url });
          })
          .catch(() => {
            // Keep linkedParty without url; will retry on next mount
          });
      }
    };

    if (useProjectStore.persist.hasHydrated()) {
      regenerateUrl();
    } else {
      const unsub = useProjectStore.persist.onFinishHydration(() => {
        regenerateUrl();
        unsub();
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    if (!linkedParty?.shortCode) {
      setServerTrackIds(null);
      return;
    }
    let cancelled = false;
    partyService
      .getPartyState(linkedParty.shortCode)
      .then((state) => {
        if (cancelled) return;
        if (state?.serverTrackIds?.length) {
          setServerTrackIds(new Set(state.serverTrackIds));
        } else {
          setServerTrackIds(null);
        }
      })
      .catch(() => {
        if (!cancelled) setServerTrackIds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedParty?.shortCode]);

  return (
    <>
      <LoudnessScanProgressModal
        open={scanState.open}
        title={scanState.title}
        completed={scanState.completed}
        total={scanState.total}
        currentTrackName={scanState.currentTrackName}
        errorMessage={scanState.errorMessage}
        onCancel={cancelScan}
      />
      <PlayerView
        allTracksCount={allTracks.length}
        totalDuration={totalDuration}
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
        onCalculateLoudness={handleCalculateLoudness}
        showLoudnessBatchButton={showLoudnessBatchButton}
        isLoudnessBatchScanning={scanState.open}
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
        formatPlannedEndTimelineLabel={formatPlannedEndTimelineLabel}
        queueEndDividerPosition={queueEndDividerPosition}
        formatQueueEndTimelineLabel={formatQueueEndTimelineLabel}
        showQueueEndDividerAtListBottom={showQueueEndDividerAtListBottom}
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
        serverTrackIds={serverTrackIds}
        jumpToTrack={mode === 'session' ? jumpToTrack : undefined}
      />
    </>
  );
};
