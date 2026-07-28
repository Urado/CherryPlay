import React from 'react';

import { ProjectItem, ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { DisplayItem } from '@shared/utils/playerItemsUtils';

import { DraggedItems, InsertPosition } from '../../modules/dragDrop/types';

import { PlayerHeader } from './components/PlayerHeader';
import { PlayerTracksList } from './components/PlayerTracksList';
import { PlayerControls } from './PlayerControls';

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

interface PlayerViewProps {
  allTracksCount: number;
  totalDuration: number;
  hasSelectedItems: boolean;
  canCreateGroup: boolean;
  canRemoveSelectedItems: boolean;
  selectedItemsCount: number;
  isPreparationMode: boolean;
  onDeselectAll: () => void;
  onCreateGroup: () => void;
  onRemoveSelectedItems: () => void;
  onSelectAll: () => void;
  onStartSession: () => void;
  onResetSession: () => void;
  onOpenGlobalSettings: () => void;
  onExportTracksToText: () => void;
  displayItems: DisplayItem[];
  zoneId: string;
  selectedItemIds: Set<string>;
  activeTrackId: string | null | undefined;
  activePlayerTrackId: string | null | undefined;
  playerStatus: string;
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
  startTrackPlayback: (track: Track) => Promise<void>;
  pausePlayback: () => void;
  onNext?: () => void;
  serverTrackIds?: Set<string> | null;
  jumpToTrack?: (trackId: string) => Promise<void>;
}

/**
 * Презентационный компонент PlayerView
 * Отображает UI плеера, вся логика находится в PlayerViewContainer
 */
export const PlayerView: React.FC<PlayerViewProps> = ({
  allTracksCount,
  totalDuration,
  hasSelectedItems,
  canCreateGroup,
  canRemoveSelectedItems,
  selectedItemsCount,
  isPreparationMode,
  onDeselectAll,
  onCreateGroup,
  onRemoveSelectedItems,
  onSelectAll,
  onStartSession,
  onResetSession,
  onOpenGlobalSettings,
  onExportTracksToText,
  displayItems,
  zoneId,
  selectedItemIds,
  activeTrackId,
  activePlayerTrackId,
  playerStatus,
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
  onNext,
  serverTrackIds = null,
  jumpToTrack,
}) => {
  return (
    <div className="playlist-view player-view">
      <PlayerHeader
        allTracksCount={allTracksCount}
        totalDuration={totalDuration}
        hasSelectedItems={hasSelectedItems}
        canCreateGroup={canCreateGroup}
        canRemoveSelectedItems={canRemoveSelectedItems}
        selectedItemsCount={selectedItemsCount}
        isPreparationMode={isPreparationMode}
        onDeselectAll={onDeselectAll}
        onCreateGroup={onCreateGroup}
        onRemoveSelectedItems={onRemoveSelectedItems}
        onSelectAll={onSelectAll}
        onStartSession={onStartSession}
        onResetSession={onResetSession}
        onOpenGlobalSettings={onOpenGlobalSettings}
        onExportTracksToText={onExportTracksToText}
      />

      <PlayerTracksList
        displayItems={displayItems}
        zoneId={zoneId}
        selectedItemIds={selectedItemIds}
        activeTrackId={activeTrackId}
        activePlayerTrackId={activePlayerTrackId}
        playerStatus={playerStatus}
        isPreparationMode={isPreparationMode}
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
        serverTrackIds={serverTrackIds}
        jumpToTrack={jumpToTrack}
      />

      {!isPreparationMode ? <PlayerControls onNext={onNext} /> : null}
    </div>
  );
};
