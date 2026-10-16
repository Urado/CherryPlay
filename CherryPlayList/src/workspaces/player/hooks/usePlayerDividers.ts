
import { isProjectTrack, type ProjectItem, type ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { useProjectStore, useSettingsStore } from '@shared/stores';
import { useCallback, useMemo } from 'react';

import {
  calculateDividerMarkers as calculateDividerMarkersUtil,
  formatDividerLabel as formatDividerLabelUtil,
  calculatePlannedEndDividerPosition,
  calculateQueueEndDividerPosition,
  calculateQueueEndMarker,
  calculatePlannedEndMarker,
  formatTimeFromDuration,
  formatTimeFromTimestamp,
  type DividerCalculationContext,
  type DividerMarkers,
} from '../dividerUtils';
import {
  PLAYER_TIMELINE_PLANNED_END_PREFIX,
  PLAYER_TIMELINE_QUEUE_END_PREFIX,
} from '../timelineCopy';

interface UsePlayerDividersOptions {
  allTracks: Track[];
  activePlayerTrackId: string | null | undefined;
  currentTrackPosition: number | undefined;
  isTrackOrGroupDisabled: (itemId: string) => boolean;
  isTrackPlayed: (trackId: string) => boolean;
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: ActionAfterTrack;
    pauseBetweenTracks: number;
  };
  displayItems: Array<{ item: ProjectItem }>;
}

export const usePlayerDividers = (options: UsePlayerDividersOptions) => {
  const {
    allTracks,
    activePlayerTrackId,
    currentTrackPosition,
    isTrackOrGroupDisabled,
    isTrackPlayed,
    getEffectiveTrackSettings,
    displayItems,
  } = options;

  const mode = useProjectStore((state) => state.sessionState.mode);
  const plannedEndTime = useProjectStore((state) => state.settings.plannedEndTime);
  const disabledTrackIds = useProjectStore((state) => state.sessionState.disabledTrackIds);
  const disabledGroupIds = useProjectStore((state) => state.sessionState.disabledGroupIds);
  const isPreparationMode = mode === 'preparation';
  const { hourDividerInterval, showHourDividers } = useSettingsStore();

  const isDividerTrackDisabled = useCallback(
    (trackId: string) => {
      if (disabledTrackIds.includes(trackId)) {
        return true;
      }
      return disabledGroupIds.length > 0 && isTrackOrGroupDisabled(trackId);
    },
    [disabledTrackIds, disabledGroupIds, isTrackOrGroupDisabled],
  );

  const dividerCalculationContext: DividerCalculationContext = useMemo(() => ({
      tracks: allTracks,
      activeTrackId: activePlayerTrackId ?? null,
      currentTrackPosition,
      mode,
      hourDividerInterval,
      isTrackDisabled: isDividerTrackDisabled,
      isTrackPlayed,
      calculateTrackDurationWithPause: (track: Track) => {
        const settings = getEffectiveTrackSettings(track.id);
        let duration = track.duration || 0;
        if (settings.actionAfterTrack === 'pauseAndNext') {
          duration += settings.pauseBetweenTracks || 0;
        }
        return duration;
      },
    }), [
      allTracks,
      activePlayerTrackId,
      currentTrackPosition,
      mode,
      hourDividerInterval,
      isDividerTrackDisabled,
      isTrackPlayed,
      getEffectiveTrackSettings,
    ]);

  const dividerMarkersResult = useMemo(() => {
    if (!showHourDividers || hourDividerInterval <= 0 || allTracks.length === 0) {
      return {
        markers: new Map<string, number | null>(),
        startPosition: {
          startFromIndex: 0,
          currentTimeOffset: 0,
          currentRealTime: null,
        },
        nextEvenTime: null,
        plannedEndMarker: null,
      };
    }
    return calculateDividerMarkersUtil({
      ...dividerCalculationContext,
      showHourDividers,
      plannedEndTime: mode === 'session' ? plannedEndTime : null,
    });
  }, [
    dividerCalculationContext,
    showHourDividers,
    hourDividerInterval,
    allTracks.length,
    mode,
    plannedEndTime,
  ]);

  const calculateDividerMarkers = dividerMarkersResult.markers;

  const formatDividerLabel = useCallback(
    (trackId: string): string => {
      return formatDividerLabelUtil(trackId, dividerCalculationContext, dividerMarkersResult);
    },
    [dividerCalculationContext, dividerMarkersResult],
  );

  const plannedEndMarker = useMemo(() => {
    if (!isPreparationMode && allTracks.length > 0 && plannedEndTime !== null) {
      return calculatePlannedEndMarker(dividerCalculationContext, plannedEndTime);
    }
    return null;
  }, [isPreparationMode, allTracks.length, plannedEndTime, dividerCalculationContext]);

  const formatPlannedEndTimeLabel = useCallback((): string => {
    if (plannedEndTime === null) {
      return '';
    }
    const ts =
      plannedEndMarker !== null && plannedEndMarker.time !== null
        ? plannedEndMarker.time
        : plannedEndTime;
    return formatTimeFromTimestamp(ts);
  }, [plannedEndTime, plannedEndMarker]);

  const plannedEndDividerPosition = useMemo(() => {
    if (!isPreparationMode && allTracks.length > 0 && plannedEndMarker !== null) {
      const tempMarkers: DividerMarkers = {
        markers: new Map<string, number | null>(),
        startPosition: dividerMarkersResult.startPosition,
        nextEvenTime: null,
        plannedEndMarker,
      };
      return calculatePlannedEndDividerPosition(tempMarkers, displayItems, isProjectTrack);
    }
    return null;
  }, [
    isPreparationMode,
    allTracks.length,
    plannedEndMarker,
    displayItems,
    dividerMarkersResult.startPosition,
  ]);

  const queueEndMarker = useMemo(() => {
    if (!showHourDividers || hourDividerInterval <= 0 || allTracks.length === 0) {
      return null;
    }
    return calculateQueueEndMarker(dividerCalculationContext);
  }, [showHourDividers, hourDividerInterval, allTracks.length, dividerCalculationContext]);

  const queueEndDividerPosition = useMemo(() => {
    return calculateQueueEndDividerPosition(queueEndMarker, displayItems, isProjectTrack);
  }, [queueEndMarker, displayItems]);

  const formatQueueEndTimelineLabel = useCallback((): string => {
    if (queueEndMarker === null) {
      return '';
    }
    if (isPreparationMode) {
      const sec = queueEndMarker.preparationDurationSeconds;
      if (sec === null) {
        return '';
      }
      return `${PLAYER_TIMELINE_QUEUE_END_PREFIX} ${formatTimeFromDuration(sec)}`;
    }
    const ts = queueEndMarker.sessionEndTimestamp;
    if (ts === null) {
      return '';
    }
    return `${PLAYER_TIMELINE_QUEUE_END_PREFIX} ${formatTimeFromTimestamp(ts)}`;
  }, [queueEndMarker, isPreparationMode]);

  const formatPlannedEndTimelineLabel = useCallback((): string => {
    const timePart = formatPlannedEndTimeLabel();
    if (!timePart) {
      return '';
    }
    return `${PLAYER_TIMELINE_PLANNED_END_PREFIX} ${timePart}`;
  }, [formatPlannedEndTimeLabel]);

  const showQueueEndDividerAtListBottom = useMemo(() => {
    return (
      showHourDividers &&
      queueEndMarker !== null &&
      queueEndDividerPosition === null &&
      displayItems.length > 0
    );
  }, [showHourDividers, queueEndMarker, queueEndDividerPosition, displayItems.length]);

  return {
    calculateDividerMarkers,
    formatDividerLabel,
    formatPlannedEndTimelineLabel,
    plannedEndDividerPosition,
    plannedEndMarker,
    queueEndDividerPosition,
    formatQueueEndTimelineLabel,
    showQueueEndDividerAtListBottom,
  };
};
