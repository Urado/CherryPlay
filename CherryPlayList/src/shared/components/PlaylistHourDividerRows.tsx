import { getHourDividerKindsAfterTrackRow, type HourDividerKind } from '@shared/utils';
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

const labelForHourDividerKind = (
  kind: HourDividerKind,
  intervalTrackId: string | undefined,
  formatPlannedEndTimelineLabel: () => string,
  formatQueueEndTimelineLabel: () => string,
  formatDividerLabel: (trackId: string) => string,
): string => {
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
};

const HourDividerRow = ({
  kind,
  label,
}: {
  kind: HourDividerKind;
  label: string;
}): React.ReactElement => {
  return (
    <div
      className={`playlist-hour-divider playlist-hour-divider--${kind}`}
      role="separator"
      aria-label={label}
    >
      <span className="playlist-hour-divider-label">{label}</span>
    </div>
  );
};

const CombinedPlanAndQueueHourDivider = ({
  plannedLabel,
  queueLabel,
}: {
  plannedLabel: string;
  queueLabel: string;
}): React.ReactElement => {
  return (
    <div
      className="playlist-hour-divider playlist-hour-divider--planned-and-queue-end"
      role="separator"
      aria-label={`${plannedLabel}, ${queueLabel}`}
    >
      <span className="playlist-hour-divider-captions">
        <span className="playlist-hour-divider-label playlist-hour-divider-label--planned-end">
          {plannedLabel}
        </span>
        <span className="playlist-hour-divider-label playlist-hour-divider-label--queue-end">
          {queueLabel}
        </span>
      </span>
    </div>
  );
};

const renderPlanAndQueueCoincidence = (
  plannedLabel: string,
  queueLabel: string,
): React.ReactElement | null => {
  if (plannedLabel.length === 0 && queueLabel.length === 0) {
    return null;
  }
  if (plannedLabel.length === 0) {
    return <HourDividerRow kind="queue-end" label={queueLabel} />;
  }
  if (queueLabel.length === 0) {
    return <HourDividerRow kind="planned-end" label={plannedLabel} />;
  }
  return <CombinedPlanAndQueueHourDivider plannedLabel={plannedLabel} queueLabel={queueLabel} />;
};

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

  if (kinds.includes('planned-end') && kinds.includes('queue-end')) {
    return renderPlanAndQueueCoincidence(
      formatPlannedEndTimelineLabel(),
      formatQueueEndTimelineLabel(),
    );
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

  if (showPlanned && showQueue) {
    return renderPlanAndQueueCoincidence(
      formatPlannedEndTimelineLabel(),
      formatQueueEndTimelineLabel(),
    );
  }

  if (showPlanned) {
    return <HourDividerRow kind="planned-end" label={formatPlannedEndTimelineLabel()} />;
  }

  return <HourDividerRow kind="queue-end" label={formatQueueEndTimelineLabel()} />;
};
