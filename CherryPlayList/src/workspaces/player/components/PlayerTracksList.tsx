import React, { useState, useCallback, useMemo } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectGroup, isProjectTrack, ProjectItem, ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import {
  ItemList,
  DropIndicator,
  ProjectItemRow,
  EmptyState,
  HourDividerAfterTrackRow,
  HourDividerListBottom,
  SettingsButton,
} from '@shared/components';
import { TrackLoudnessRowControls } from '@shared/components/loudness/TrackLoudnessRowControls';
import { useSelectionWithModifiers } from '@shared/hooks';
import { useProjectStore } from '@shared/stores';
import { isItemDragState } from '@shared/stores/dragDropStore';
import { getDuplicateTrackIdsFromDisplayItems } from '@shared/utils';
import { DisplayItem } from '@shared/utils/playerItemsUtils';

import { DraggedItems, InsertPosition } from '../../../modules/dragDrop/types';
import { TrackActionsDropdown } from '../TrackActionsDropdown';
import { TrackSettingsDropdown } from '../TrackSettingsDropdown';
import {
  getItemState,
  isItemLocked,
  calculateGroupDurationWithPauses,
} from '../utils/itemStateUtils';

interface DragAndDropState {
  draggedItems: DraggedItems;
  dragOverId: string | null;
  dragOverIndex: number | null;
  insertPosition: InsertPosition | null;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent, targetFlatIndex: number) => void;
  handleDrop: (e: React.DragEvent, targetFlatIndex: number) => void;
  handleDragOverContainer: (e: React.DragEvent) => void;
  handleDropOnContainer: (e: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleDragLeave: (e: React.DragEvent) => void;
}

interface PlayerTracksListProps {
  displayItems: DisplayItem[];
  zoneId: string;
  selectedItemIds: Set<string>;
  activeTrackId: string | null | undefined;
  activePlayerTrackId: string | null | undefined;
  playerStatus: string;
  isPreparationMode: boolean;
  mode: 'preparation' | 'session';
  showHourDividers: boolean;
  plannedEndTime: number | null;
  plannedEndDividerPosition: number | null;
  calculateDividerMarkers: Map<string, number | null>;
  playerDrag: DragAndDropState;
  getAllTracksInOrder: (items: ProjectItem[]) => Track[];
  isTrackPlayed: (id: string) => boolean;
  isGroupDisabled: (id: string) => boolean;
  isTrackOrGroupDisabled: (id: string) => boolean;
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: ActionAfterTrack;
    pauseBetweenTracks: number;
  };
  formatDividerLabel: (trackId: string) => string;
  formatPlannedEndTimelineLabel: () => string;
  queueEndDividerPosition: number | null;
  formatQueueEndTimelineLabel: () => string;
  showQueueEndDividerAtListBottom: boolean;
  toggleItemSelection: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  removeItem: (id: string) => void;
  setGroupName: (groupId: string, name: string) => void;
  handleToggleDisabled: (itemId: string) => void;
  handleUngroupGroup: (groupId: string) => void;
  handleOpenTrackSettings: (itemId: string) => void;
  startTrackPlayback: (track: Track) => Promise<void> | void;
  pausePlayback: () => void;
  serverTrackIds?: Set<string> | null;
  jumpToTrack?: (trackId: string) => Promise<void>;
}

export const PlayerTracksList: React.FC<PlayerTracksListProps> = ({
  displayItems,
  zoneId: _zoneId,
  selectedItemIds,
  activeTrackId,
  activePlayerTrackId,
  playerStatus,
  isPreparationMode,
  mode: _mode,
  showHourDividers,
  plannedEndTime,
  plannedEndDividerPosition,
  calculateDividerMarkers,
  playerDrag,
  getAllTracksInOrder,
  isTrackPlayed,
  isGroupDisabled,
  isTrackOrGroupDisabled,
  getEffectiveTrackSettings,
  formatDividerLabel,
  formatPlannedEndTimelineLabel,
  queueEndDividerPosition,
  formatQueueEndTimelineLabel,
  showQueueEndDividerAtListBottom,
  toggleItemSelection,
  selectRange,
  removeItem,
  setGroupName,
  handleToggleDisabled,
  handleUngroupGroup,
  handleOpenTrackSettings,
  startTrackPlayback,
  pausePlayback,
  serverTrackIds = null,
  jumpToTrack,
}) => {
  const { getGroupSettings, getTrackSettings } = useProjectStore();

  const duplicateTrackIds = useMemo(
    () => getDuplicateTrackIdsFromDisplayItems(displayItems),
    [displayItems],
  );

  const [trackSettingsDropdown, setTrackSettingsDropdown] = useState<{
    trackId: string;
    anchorRect: DOMRect;
  } | null>(null);

  const closeTrackSettingsDropdown = useCallback(() => setTrackSettingsDropdown(null), []);

  const [trackActionsDropdown, setTrackActionsDropdown] = useState<{
    trackId: string;
    anchorRect: DOMRect;
  } | null>(null);

  const closeTrackActionsDropdown = useCallback(() => setTrackActionsDropdown(null), []);

  const showPlannedEndDividerAtListBottom =
    !isPreparationMode && plannedEndTime !== null && plannedEndDividerPosition === null;

  const { handleToggleSelect } = useSelectionWithModifiers({
    toggleSelection: toggleItemSelection,
    selectRange,
  });

  const renderSettingsButton = (item: ProjectItem, isGroup: boolean) => {
    let hasCustomSettings = false;
    let settingsActionAfterTrack: string | null = null;

    if (isGroup) {
      const groupSettings = getGroupSettings(item.id);
      hasCustomSettings =
        groupSettings.actionAfterTrack !== null && groupSettings.actionAfterTrack !== undefined;
      settingsActionAfterTrack = groupSettings.actionAfterTrack || null;
    } else {
      const trackSettings = getTrackSettings(item.id);
      hasCustomSettings =
        trackSettings.actionAfterTrack !== null && trackSettings.actionAfterTrack !== undefined;
      settingsActionAfterTrack = trackSettings.actionAfterTrack || null;
    }

    const indicator =
      hasCustomSettings && settingsActionAfterTrack
        ? settingsActionAfterTrack === 'pause'
          ? '⏸'
          : settingsActionAfterTrack === 'pauseAndNext'
            ? '⏸⏭'
            : '⏭'
        : undefined;

    return (
      <SettingsButton
        title={isGroup ? 'Настройки тайминга группы' : 'Настройки тайминга трека'}
        indicator={indicator}
        onClick={(e) => {
          if (isGroup) {
            handleOpenTrackSettings(item.id);
          } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setTrackSettingsDropdown({ trackId: item.id, anchorRect: rect });
          }
        }}
      />
    );
  };

  return (
    <>
      {trackSettingsDropdown && (
        <TrackSettingsDropdown
          key={trackSettingsDropdown.trackId}
          trackId={trackSettingsDropdown.trackId}
          anchorRect={trackSettingsDropdown.anchorRect}
          onClose={closeTrackSettingsDropdown}
        />
      )}
      {trackActionsDropdown && (
        <TrackActionsDropdown
          key={trackActionsDropdown.trackId}
          trackId={trackActionsDropdown.trackId}
          anchorRect={trackActionsDropdown.anchorRect}
          onClose={closeTrackActionsDropdown}
          onJumpToTrack={!isPreparationMode && jumpToTrack ? jumpToTrack : undefined}
        />
      )}
      <ItemList
        className="playlist-tracks"
        workspaceId={DEFAULT_PLAYER_WORKSPACE_ID}
        onDragOver={playerDrag.handleDragOverContainer}
        onDragLeave={playerDrag.handleDragLeave}
        onDragEnd={playerDrag.handleDragEnd}
        onDrop={playerDrag.handleDropOnContainer}
        emptyState={
          <EmptyState message="Player is empty" hint="Перетащите треки сюда для воспроизведения" />
        }
      >
        {displayItems.map((displayItem) => {
          const { item, level, displayIndex, flatIndex } = displayItem;
          const isGroup = isProjectGroup(item);
          const track = isProjectTrack(item) ? item : null;

          const isDraggedItem =
            isItemDragState(playerDrag.draggedItems) &&
            playerDrag.draggedItems.allFlatIndices.has(flatIndex);
          // Demo preview highlight (play button) vs session current track (dividers / isCurrent)
          const isPreviewActive = activeTrackId === item.id;
          const isPlaying = isPreviewActive && playerStatus === 'playing';
          const isCurrentTrack = track?.id === activePlayerTrackId;

          const showPlannedEndDividerBeforeActive =
            !isPreparationMode &&
            plannedEndTime !== null &&
            plannedEndDividerPosition === -1 &&
            track !== null &&
            item.id === activePlayerTrackId;

          const hasPlannedEndDivider =
            !isPreparationMode &&
            plannedEndTime !== null &&
            plannedEndDividerPosition === flatIndex;
          const hasQueueEndDivider =
            showHourDividers &&
            queueEndDividerPosition !== null &&
            queueEndDividerPosition === flatIndex;
          const showDivider =
            showHourDividers &&
            isProjectTrack(item) &&
            track !== null &&
            calculateDividerMarkers.has(track.id);

          const itemState = getItemState(
            item,
            isTrackPlayed,
            isGroupDisabled,
            isTrackOrGroupDisabled,
            getAllTracksInOrder,
          );
          const isLocked = isItemLocked(
            item,
            isPreparationMode,
            activePlayerTrackId,
            itemState,
            getAllTracksInOrder,
            isTrackPlayed,
          );

          const groupDurationWithPauses = isGroup
            ? calculateGroupDurationWithPauses(item, getAllTracksInOrder, getEffectiveTrackSettings)
            : undefined;

          const rowMode = isPreparationMode ? 'player-preparation' : 'player-session';

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
                index={displayIndex}
                listIndex={flatIndex}
                level={level}
                mode={rowMode}
                isSelected={selectedItemIds.has(item.id)}
                isDragging={isDraggedItem}
                isDragOver={playerDrag.dragOverIndex === flatIndex && !isDraggedItem}
                insertPosition={
                  playerDrag.dragOverIndex === flatIndex && !isDraggedItem
                    ? playerDrag.insertPosition
                    : null
                }
                isActive={isPreviewActive}
                isPlaying={isPlaying}
                isPlayed={itemState.isPlayed}
                isDisabled={itemState.isDisabled}
                isCurrent={isCurrentTrack}
                isLocked={isLocked}
                groupDuration={groupDurationWithPauses}
                isDuplicatePath={track ? duplicateTrackIds.has(track.id) : false}
                isNotOnServer={
                  track && serverTrackIds != null ? !serverTrackIds.has(track.id) : false
                }
                onToggleSelect={handleToggleSelect}
                onRemove={removeItem}
                onDragStart={(e) => playerDrag.handleDragStart(e, item.id)}
                onDragOver={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'none';
                    return;
                  }
                  playerDrag.handleDragOver(e, flatIndex);
                }}
                onDrop={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    return;
                  }
                  playerDrag.handleDrop(e, flatIndex);
                }}
                onDragEnd={playerDrag.handleDragEnd}
                onPlay={startTrackPlayback}
                onPause={pausePlayback}
                onToggleDisabled={handleToggleDisabled}
                onRenameGroup={setGroupName}
                onUngroupGroup={handleUngroupGroup}
                settingsButton={renderSettingsButton(item, isGroup)}
                onTrackActions={
                  !isGroup
                    ? (itemId, rect) =>
                        setTrackActionsDropdown({ trackId: itemId, anchorRect: rect })
                    : undefined
                }
                trackActionsDisabled={!jumpToTrack || item.id === activePlayerTrackId}
                loudnessControls={track ? <TrackLoudnessRowControls track={track} /> : undefined}
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
    </>
  );
};
