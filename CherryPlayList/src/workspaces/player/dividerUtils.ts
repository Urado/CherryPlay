// Re-export common divider utilities from shared
export {
  calculateSimpleDividerMarkers,
  formatSimpleDividerLabel,
  formatTimeFromTimestamp,
  formatTimeFromDuration,
  calculateDividerMarkers,
  calculatePlannedEndDividerPosition,
  calculateProjectedEndTime,
  calculatePlannedEndMarker,
  calculateStartPosition,
  calculateNextEvenTime,
  calculateAccumulatedDuration,
  findStartIndex,
} from '@shared/utils/dividerUtils';

export type {
  DividerCalculationContext,
  StartPosition,
  DividerMarkers,
} from '@shared/utils/dividerUtils';

// Player-specific imports
import type { DividerCalculationContext, DividerMarkers } from '@shared/utils/dividerUtils';

import { formatPreparationDividerLabel } from './utils/dividerPreparationUtils';
import { formatSessionDividerLabel } from './utils/dividerSessionUtils';

/**
 * Форматирует метку отсечки для указанного трека
 * Делегирует вызов соответствующей функции в зависимости от режима
 * (Player-specific function)
 */
export function formatDividerLabel(
  trackId: string,
  context: DividerCalculationContext,
  dividerMarkers: DividerMarkers,
): string {
  if (context.mode === 'session') {
    return formatSessionDividerLabel(trackId, context, dividerMarkers);
  } else {
    return formatPreparationDividerLabel(trackId, context);
  }
}
