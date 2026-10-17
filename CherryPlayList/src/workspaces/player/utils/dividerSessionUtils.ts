import {
  DividerCalculationContext,
  DividerMarkers,
  calculateAccumulatedDuration,
  calculateNextEvenTime,
  formatTimeFromTimestamp,
} from '@shared/utils/dividerUtils';

export const formatSessionDividerLabel = (
  trackId: string,
  context: DividerCalculationContext,
  dividerMarkers: DividerMarkers,
): string => {
  const { tracks, hourDividerInterval } = context;

  const trackIndex = tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1 || hourDividerInterval <= 0) {
    return '';
  }

  const dividerTime = dividerMarkers.markers.get(trackId);

  if (dividerTime !== null && dividerTime !== undefined && dividerTime > 0) {
    return formatTimeFromTimestamp(dividerTime);
  }

  const { startPosition } = dividerMarkers;
  const { startFromIndex, currentRealTime } = startPosition;

  if (currentRealTime === null) {
    return '';
  }

  const accumulatedDuration = calculateAccumulatedDuration(
    tracks,
    startFromIndex,
    trackIndex,
    context,
  );

  const futureRealTime = currentRealTime + accumulatedDuration * 1000;

  const nextEvenTime = calculateNextEvenTime(currentRealTime, hourDividerInterval);

  let currentEvenTime = nextEvenTime;
  while (futureRealTime >= currentEvenTime) {
    currentEvenTime += hourDividerInterval * 1000;
  }

  const prevEvenTime = currentEvenTime - hourDividerInterval * 1000;
  return formatTimeFromTimestamp(prevEvenTime);
};
