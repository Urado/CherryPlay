import { useCallback, useMemo } from 'react';

import { isProjectTrack, type ProjectItem, type ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { useProjectStore, useSettingsStore } from '@shared/stores';

import {
  calculateDividerMarkers as calculateDividerMarkersUtil,
  formatDividerLabel as formatDividerLabelUtil,
  calculatePlannedEndDividerPosition,
  calculateProjectedEndTime,
  calculatePlannedEndMarker,
  formatTimeFromTimestamp,
  type DividerCalculationContext,
  type DividerMarkers,
} from '../dividerUtils';

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

/**
 * Хук для управления логикой отсечек
 */
export function usePlayerDividers(options: UsePlayerDividersOptions) {
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
  const isPreparationMode = mode === 'preparation';
  const { hourDividerInterval, showHourDividers } = useSettingsStore();

  // Вычисление позиций отсечек (возвращает Map: trackId -> время отсечки в формате timestamp)
  // В режиме сессии: старт отсчета - текущий трек и текущее время, проигранные и отключенные треки игнорируются
  const dividerCalculationContext: DividerCalculationContext = useMemo(
    () => ({
      tracks: allTracks,
      activeTrackId: activePlayerTrackId ?? null,
      currentTrackPosition,
      mode,
      hourDividerInterval,
      isTrackDisabled: isTrackOrGroupDisabled,
      isTrackPlayed,
      calculateTrackDurationWithPause: (track: Track) => {
        const settings = getEffectiveTrackSettings(track.id);
        let duration = track.duration || 0;
        if (settings.actionAfterTrack === 'pauseAndNext') {
          duration += settings.pauseBetweenTracks || 0;
        }
        return duration;
      },
    }),
    [
      allTracks,
      activePlayerTrackId,
      currentTrackPosition,
      mode,
      hourDividerInterval,
      isTrackOrGroupDisabled,
      isTrackPlayed,
      getEffectiveTrackSettings,
    ],
  );

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

  // Форматирование метки отсечки
  // Использует данные из calculateDividerMarkers, чтобы избежать несоответствий
  const formatDividerLabel = useCallback(
    (trackId: string): string => {
      return formatDividerLabelUtil(trackId, dividerCalculationContext, dividerMarkersResult);
    },
    [dividerCalculationContext, dividerMarkersResult],
  );

  // Прогнозируемое время окончания плейлиста
  // Использует ту же логику, что и calculateDividerMarkers
  const projectedEndTime = useMemo(() => {
    return calculateProjectedEndTime(dividerCalculationContext);
  }, [dividerCalculationContext]);

  // Форматирование прогнозируемого времени окончания
  const formatProjectedEndTime = useCallback((): string => {
    if (projectedEndTime === null) {
      return '';
    }
    return formatTimeFromTimestamp(projectedEndTime);
  }, [projectedEndTime]);

  // Форматирование метки планового времени окончания
  const formatPlannedEndTimeLabel = useCallback((): string => {
    if (plannedEndTime === null) {
      return '';
    }
    return formatTimeFromTimestamp(plannedEndTime);
  }, [plannedEndTime]);

  // Вычисление plannedEndMarker независимо от showHourDividers
  // Красная отсечка должна показываться всегда при наличии plannedEndTime
  const plannedEndMarker = useMemo(() => {
    if (!isPreparationMode && allTracks.length > 0 && plannedEndTime !== null) {
      return calculatePlannedEndMarker(dividerCalculationContext, plannedEndTime);
    }
    return null;
  }, [isPreparationMode, allTracks.length, plannedEndTime, dividerCalculationContext]);

  // Форматирование времени из plannedEndMarker (для отображения на отсечке)
  const formatPlannedEndMarkerTime = useCallback((): string => {
    const markerTime = plannedEndMarker?.time;
    if (markerTime !== null && markerTime !== undefined && markerTime > 0) {
      return formatTimeFromTimestamp(markerTime);
    }
    return formatPlannedEndTimeLabel();
  }, [plannedEndMarker, formatPlannedEndTimeLabel]);

  // Вычисление позиции красной отсечки о конце
  // Использует plannedEndMarker, вычисленный независимо от showHourDividers
  const plannedEndDividerPosition = useMemo(() => {
    if (!isPreparationMode && allTracks.length > 0 && plannedEndMarker !== null) {
      // Создаём временный объект DividerMarkers для использования существующей функции
      const tempMarkers: DividerMarkers = {
        markers: new Map<string, number | null>(),
        startPosition: dividerMarkersResult.startPosition,
        nextEvenTime: null,
        plannedEndMarker,
      };
      return calculatePlannedEndDividerPosition(tempMarkers, displayItems, isProjectTrack);
    }
    // Если не нашли позицию или в режиме подготовки, возвращаем null (отсечка в конце)
    return null;
  }, [
    isPreparationMode,
    allTracks.length,
    plannedEndMarker,
    displayItems,
    dividerMarkersResult.startPosition,
  ]);

  return {
    calculateDividerMarkers,
    formatDividerLabel,
    projectedEndTime,
    formatProjectedEndTime,
    formatPlannedEndTimeLabel,
    formatPlannedEndMarkerTime,
    plannedEndDividerPosition,
    plannedEndMarker,
  };
}
