import {
  getHourDividerKindsAfterTrackRow,
  type HourDividerKind,
} from '@shared/utils';
import React from 'react';

export interface HourDividerAfterTrackRowProps {
  hasPlannedEndDivider: boolean;
  hasQueueEndDivider: boolean;
  showIntervalDivider: boolean;
  intervalTrackId: string | undefined;
  formatPlannedEndTimelineLabel: () => string;
  formatQueueEndTimelineLabel: () => string;
  formatDividerLabel: (trackId: string) => string;
}

function labelForHourDividerKind(
  kind: HourDividerKind,
  intervalTrackId: string | undefined,
  formatPlannedEndTimelineLabel: () => string,
  formatQueueEndTimelineLabel: () => string,
  formatDividerLabel: (trackId: string) => string,
): string {
  if (kind === 'planned-end') {
    return formatPlannedEndTimelineLabel();
  }
  if (kind === 'queue-end') {
    return formatQueueEndTimelineLabel();
  }
  if (!intervalTrackId) {
    return '';
  }
  return formatDividerLabel(intervalTrackId);
}

const HourDividerRow = ({
  kind,
  label,
}: {
  kind: HourDividerKind;
  label: string;
}): React.ReactElement => {
  return (
    <div className={`playlist-hour-divider playlist-hour-divider--${kind}`}>
      <span className="playlist-hour-divider-label">{label}</span>
    </div>
  );
}

export const HourDividerAfterTrackRow = ({
  hasPlannedEndDivider,
  hasQueueEndDivider,
  showIntervalDivider,
  intervalTrackId,
  formatPlannedEndTimelineLabel,
  formatQueueEndTimelineLabel,
  formatDividerLabel,
}: HourDividerAfterTrackRowProps): React.ReactElement | null => {
  const kinds = getHourDividerKindsAfterTrackRow(
    hasPlannedEndDivider,
    hasQueueEndDivider,
    showIntervalDivider,
  );
  if (kinds.length === 0) {
    return null;
  }

  const rows = kinds
    .map((kind) => ({
      kind,
      label: labelForHourDividerKind(
        kind,
        intervalTrackId,
        formatPlannedEndTimelineLabel,
        formatQueueEndTimelineLabel,
        formatDividerLabel,
      ),
    }))
    .filter((row) => row.label.length > 0);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      {rows.map((row) => (
        <HourDividerRow key={row.kind} kind={row.kind} label={row.label} />
      ))}
    </>
  );
};

export interface HourDividerListBottomProps {
  showPlannedEndDividerAtListBottom: boolean;
  displayItemsLength: number;
  showQueueEndDividerAtListBottom: boolean;
  formatPlannedEndTimelineLabel: () => string;
  formatQueueEndTimelineLabel: () => string;
}

export const HourDividerListBottom = ({
  showPlannedEndDividerAtListBottom,
  displayItemsLength,
  showQueueEndDividerAtListBottom,
  formatPlannedEndTimelineLabel,
  formatQueueEndTimelineLabel,
}: HourDividerListBottomProps): React.ReactElement | null => {
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
};
