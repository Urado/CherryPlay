export {
  calculateSimpleDividerMarkers,
  formatSimpleDividerLabel,
  formatTimeFromTimestamp,
  formatTimeFromDuration,
  calculateDividerMarkers,
  calculatePlannedEndDividerPosition,
  calculateTrackAnchorDividerPosition,
  calculateQueueEndMarker,
  calculateQueueEndDividerPosition,
  calculateProjectedEndTime,
  calculatePlannedEndMarker,
  getPriorityHourDividerKind,
  calculateStartPosition,
  calculateNextEvenTime,
  calculateAccumulatedDuration,
  findStartIndex,
} from '@shared/utils/dividerUtils';

export type {
  DividerCalculationContext,
  StartPosition,
  DividerMarkers,
  QueueEndMarker,
} from '@shared/utils/dividerUtils';

import type { DividerCalculationContext, DividerMarkers } from '@shared/utils/dividerUtils';

import { formatPreparationDividerLabel } from './utils/dividerPreparationUtils';
import { formatSessionDividerLabel } from './utils/dividerSessionUtils';

export const formatDividerLabel = (
  trackId: string,
  context: DividerCalculationContext,
  dividerMarkers: DividerMarkers,
): string => {
  if (context.mode === 'session') {
    return formatSessionDividerLabel(trackId, context, dividerMarkers);
  } else {
    return formatPreparationDividerLabel(trackId, context);
  }
};
