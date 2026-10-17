import { DividerCalculationContext, formatTimeFromDuration } from '@shared/utils/dividerUtils';

export const formatPreparationDividerLabel = (
  trackId: string,
  context: DividerCalculationContext,
): string => {
  const { tracks, hourDividerInterval } = context;

  const trackIndex = tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1 || hourDividerInterval <= 0) {
    return '';
  }

  let accumulatedDuration = 0;
  for (let i = 0; i <= trackIndex && i < tracks.length; i++) {
    const track = tracks[i];
    if (context.isTrackDisabled(track.id)) {
      continue;
    }
    accumulatedDuration += context.calculateTrackDurationWithPause(track);
  }
  return formatTimeFromDuration(accumulatedDuration);
};
