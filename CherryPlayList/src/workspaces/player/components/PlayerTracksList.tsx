import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectGroup, isProjectTrack, ProjectItem, ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { ItemList, DropIndicator, ProjectItemRow, EmptyState } from '@shared/components';
import { useSelectionWithModifiers } from '@shared/hooks';
import { useProjectStore } from '@shared/stores';
import { isItemDragState } from '@shared/stores/dragDropStore';
import { DisplayItem } from '@shared/utils/playerItemsUtils';

import { DraggedItems, InsertPosition } from '../../../modules/dragDrop/types';
import { formatTimeFromTimestamp } from '../dividerUtils';
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
  formatPlannedEndTimeLabel: () => string;
  formatPlannedEndMarkerTime: () => string;
  toggleItemSelection: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  removeItem: (id: string) => void;
  setGroupName: (groupId: string, name: string) => void;
  handleToggleDisabled: (itemId: string) => void;
  handleUngroupGroup: (groupId: string) => void;
  handleOpenTrackSettings: (itemId: string) => void;
  startTrackPlayback: (track: Track) => Promise<void> | void;
  pausePlayback: () => void;
}

export const PlayerTracksList: React.FC<PlayerTracksListProps> = ({
  displayItems,
  zoneId: _zoneId,
  selectedItemIds,
  activeTrackId,
  activePlayerTrackId,
  playerStatus,
  isPreparationMode,
  mode,
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
  formatPlannedEndTimeLabel,
  formatPlannedEndMarkerTime,
  toggleItemSelection,
  selectRange,
  removeItem,
  setGroupName,
  handleToggleDisabled,
  handleUngroupGroup,
  handleOpenTrackSettings,
  startTrackPlayback,
  pausePlayback,
}) => {
  const { getGroupSettings, getTrackSettings } = useProjectStore();

  // Use unified selection with modifiers hook
  const { handleToggleSelect } = useSelectionWithModifiers({
    toggleSelection: toggleItemSelection,
    selectRange,
  });

  // Render settings button with indicator
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

    return (
      <button
        className="playlist-item-settings"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenTrackSettings(item.id);
        }}
        title={isGroup ? 'Настройки группы' : 'Настройки трека'}
      >
        <SettingsIcon style={{ fontSize: '18px' }} />
        {hasCustomSettings && settingsActionAfterTrack && (
          <span className="player-settings-indicator">
            {settingsActionAfterTrack === 'pause'
              ? '⏸'
              : settingsActionAfterTrack === 'pauseAndNext'
                ? '⏸⏭'
                : '⏭'}
          </span>
        )}
      </button>
    );
  };

  return (
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
        const isActive = activeTrackId === item.id;
        const isPlaying = isActive && playerStatus === 'playing';

        // Planned end divider before active track
        const showPlannedEndDividerBeforeActive =
          !isPreparationMode &&
          plannedEndTime !== null &&
          plannedEndDividerPosition === -1 &&
          isActive &&
          track !== null;

        // Check if we need to show divider for this track
        const hasPlannedEndDivider =
          !isPreparationMode && plannedEndTime !== null && plannedEndDividerPosition === flatIndex;
        const showDivider =
          showHourDividers &&
          isProjectTrack(item) &&
          track !== null &&
          calculateDividerMarkers.has(track.id) &&
          !hasPlannedEndDivider;
        const dividerTime = track ? (calculateDividerMarkers.get(track.id) ?? null) : null;

        // Get item state
        const itemState = getItemState(
          item,
          isTrackPlayed,
          isGroupDisabled,
          isTrackOrGroupDisabled,
          getAllTracksInOrder,
        );

        const isCurrentTrack = track?.id === activePlayerTrackId;
        const isLocked = isItemLocked(
          item,
          isPreparationMode,
          activePlayerTrackId,
          itemState,
          getAllTracksInOrder,
          isTrackPlayed,
        );

        // Calculate group duration with pauses
        const groupDurationWithPauses = isGroup
          ? calculateGroupDurationWithPauses(item, getAllTracksInOrder, getEffectiveTrackSettings)
          : undefined;

        // Determine mode for ProjectItemRow
        const rowMode = isPreparationMode ? 'player-preparation' : 'player-session';

        return (
          <React.Fragment key={item.id}>
            <DropIndicator index={flatIndex} />
            {/* Planned end divider before active track */}
            {showPlannedEndDividerBeforeActive && (
              <div className="playlist-hour-divider playlist-hour-divider--planned-end">
                <span className="playlist-hour-divider-label">{formatPlannedEndTimeLabel()}</span>
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
              isActive={isActive}
              isPlaying={isPlaying}
              isPlayed={itemState.isPlayed}
              isDisabled={itemState.isDisabled}
              isCurrent={isCurrentTrack}
              isLocked={isLocked}
              groupDuration={groupDurationWithPauses}
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
            />
            {/* Hour divider after track */}
            {showDivider && track && (
              <div className="playlist-hour-divider">
                <span className="playlist-hour-divider-label">
                  {mode === 'session' &&
                  dividerTime !== undefined &&
                  dividerTime !== null &&
                  dividerTime > 0
                    ? formatTimeFromTimestamp(dividerTime)
                    : formatDividerLabel(track.id)}
                </span>
              </div>
            )}
            {/* Planned end divider */}
            {hasPlannedEndDivider && (
              <div className="playlist-hour-divider playlist-hour-divider--planned-end">
                <span className="playlist-hour-divider-label">
                  {mode === 'session' ? formatPlannedEndMarkerTime() : formatPlannedEndTimeLabel()}
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}
      <DropIndicator index={displayItems.length} />
      {/* Planned end divider at the end */}
      {!isPreparationMode &&
        plannedEndTime !== null &&
        plannedEndDividerPosition === null &&
        displayItems.length > 0 && (
          <div className="playlist-hour-divider playlist-hour-divider--planned-end">
            <span className="playlist-hour-divider-label">{formatPlannedEndTimeLabel()}</span>
          </div>
        )}
    </ItemList>
  );
};
