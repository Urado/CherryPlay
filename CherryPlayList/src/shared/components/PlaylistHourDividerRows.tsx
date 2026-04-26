import React from 'react';

import { getPriorityHourDividerKind } from '@shared/utils';

export interface HourDividerAfterTrackRowProps {
  hasPlannedEndDivider: boolean;
  hasQueueEndDivider: boolean;
  showIntervalDivider: boolean;
  /** Track id for interval/hour divider label; required when showIntervalDivider is true */
  intervalTrackId: string | undefined;
  formatPlannedEndTimelineLabel: () => string;
  formatQueueEndTimelineLabel: () => string;
  formatDividerLabel: (trackId: string) => string;
}

/**
 * Одна отсечка после строки трека (приоритет: план — конец очереди — интервал).
 * Общая разметка для плеера и плейлиста.
 */
export function HourDividerAfterTrackRow({
  hasPlannedEndDivider,
  hasQueueEndDivider,
  showIntervalDivider,
  intervalTrackId,
  formatPlannedEndTimelineLabel,
  formatQueueEndTimelineLabel,
  formatDividerLabel,
}: HourDividerAfterTrackRowProps): React.ReactElement | null {
  const kind = getPriorityHourDividerKind(
    hasPlannedEndDivider,
    hasQueueEndDivider,
    showIntervalDivider,
  );
  if (kind === null) {
    return null;
  }

  let dividerLabel: string;
  if (kind === 'planned-end') {
    dividerLabel = formatPlannedEndTimelineLabel();
  } else if (kind === 'queue-end') {
    dividerLabel = formatQueueEndTimelineLabel();
  } else {
    if (!intervalTrackId) {
      return null;
    }
    dividerLabel = formatDividerLabel(intervalTrackId);
  }
  if (!dividerLabel) {
    return null;
  }

  return (
    <div className={`playlist-hour-divider playlist-hour-divider--${kind}`}>
      <span className="playlist-hour-divider-label">{dividerLabel}</span>
    </div>
  );
}

export interface HourDividerListBottomProps {
  showPlannedEndDividerAtListBottom: boolean;
  displayItemsLength: number;
  showQueueEndDividerAtListBottom: boolean;
  formatPlannedEndTimelineLabel: () => string;
  formatQueueEndTimelineLabel: () => string;
}

/**
 * Отсечки внизу списка, когда обе привязки ушли в «хвост» (position === null):
 * показываем обе подряд, без приоритета planned над queue-end — иначе теряется маркер конца очереди.
 */
export function HourDividerListBottom({
  showPlannedEndDividerAtListBottom,
  displayItemsLength,
  showQueueEndDividerAtListBottom,
  formatPlannedEndTimelineLabel,
  formatQueueEndTimelineLabel,
}: HourDividerListBottomProps): React.ReactElement | null {
  const showPlanned = showPlannedEndDividerAtListBottom && displayItemsLength > 0;
  const showQueue = showQueueEndDividerAtListBottom;

  if (!showPlanned && !showQueue) {
    return null;
  }

  return (
    <>
      {showPlanned && (
        <div className="playlist-hour-divider playlist-hour-divider--planned-end">
          <span className="playlist-hour-divider-label">{formatPlannedEndTimelineLabel()}</span>
        </div>
      )}
      {showQueue && (
        <div className="playlist-hour-divider playlist-hour-divider--queue-end">
          <span className="playlist-hour-divider-label">{formatQueueEndTimelineLabel()}</span>
        </div>
      )}
    </>
  );
}
