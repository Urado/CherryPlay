import * as signalR from '@microsoft/signalr';
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
  name: string;
  onNameChange: (name: string) => void;
  allTracksCount: number;
  totalDuration: number;
  projectedEndTime: string | null;
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
  formatPlannedEndTimeLabel: () => string;
  formatPlannedEndMarkerTime: () => string;
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
  connectionState: signalR.HubConnectionState | null;
  serverTrackIds?: Set<string> | null;
}

/**
 * Презентационный компонент PlayerView
 * Отображает UI плеера, вся логика находится в PlayerViewContainer
 */
export const PlayerView: React.FC<PlayerViewProps> = ({
  name,
  onNameChange,
  allTracksCount,
  totalDuration,
  projectedEndTime,
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
  onNext,
  connectionState,
  serverTrackIds = null,
}) => {
  return (
    <div className="playlist-view player-view">
      <PlayerHeader
        name={name}
        onNameChange={onNameChange}
        allTracksCount={allTracksCount}
        totalDuration={totalDuration}
        projectedEndTime={projectedEndTime}
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
        connectionState={connectionState}
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
        serverTrackIds={serverTrackIds}
      />

      <PlayerControls onNext={onNext} />
    </div>
  );
};
