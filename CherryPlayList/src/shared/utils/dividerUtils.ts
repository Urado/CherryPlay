import { Track } from '@core/types/track';

export interface DividerCalculationContext {
  tracks: Track[];
  activeTrackId: string | null;
  currentTrackPosition: number | undefined;
  mode: 'preparation' | 'session';
  hourDividerInterval: number;
  isTrackDisabled: (trackId: string) => boolean;
  isTrackPlayed: (trackId: string) => boolean;
  calculateTrackDurationWithPause: (track: Track) => number;
}

export interface StartPosition {
  startFromIndex: number;
  currentTimeOffset: number;
  currentRealTime: number | null;
}

export const findStartIndex = (
  tracks: Track[],
  activeTrackId: string | null,
  isTrackDisabled: (trackId: string) => boolean,
  isTrackPlayed: (trackId: string) => boolean,
): number => {
  if (activeTrackId) {
    const currentTrackIndex = tracks.findIndex((t) => t.id === activeTrackId);
    if (currentTrackIndex !== -1) {
      return currentTrackIndex;
    }
  }

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (!isTrackDisabled(track.id) && !isTrackPlayed(track.id)) {
      return i;
    }
  }

  return 0;
};

export const calculateStartPosition = (context: DividerCalculationContext): StartPosition => {
  const { activeTrackId, mode, isTrackDisabled, isTrackPlayed, tracks } = context;

  const startFromIndex = findStartIndex(tracks, activeTrackId, isTrackDisabled, isTrackPlayed);

  let currentTimeOffset = 0;
  let currentRealTime: number | null = null;

  if (mode === 'session') {
    currentRealTime = Date.now();
    currentTimeOffset = 0;
  }

  return {
    startFromIndex,
    currentTimeOffset,
    currentRealTime,
  };
};

export const calculateNextEvenTime = (currentTime: number, hourDividerInterval: number): number => {
  const currentDate = new Date(currentTime);
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const intervalMinutes = hourDividerInterval / 60;

  const nextEvenMinutes =
    Math.floor(currentMinutes / intervalMinutes) * intervalMinutes + intervalMinutes;
  const nextEvenDate = new Date(currentDate);
  nextEvenDate.setHours(Math.floor(nextEvenMinutes / 60));
  nextEvenDate.setMinutes(nextEvenMinutes % 60);
  nextEvenDate.setSeconds(0);
  nextEvenDate.setMilliseconds(0);

  return nextEvenDate.getTime();
};

const getSessionOrFullTrackDurationSeconds = (
  context: DividerCalculationContext,
  track: Track,
): number => {
  const full = context.calculateTrackDurationWithPause(track);
  if (context.mode !== 'session' || context.activeTrackId !== track.id) {
    return full;
  }
  if (context.isTrackPlayed(track.id)) {
    return full;
  }
  const pos = context.currentTrackPosition;
  if (pos === undefined || pos <= 0) {
    return full;
  }
  return Math.max(0, full - Math.min(pos, full));
};

const shiftAccumulatedForSessionCurrentTrackStart = (
  context: DividerCalculationContext,
  track: Track,
  accumulatedDuration: number,
): number => {
  if (
    context.mode !== 'session' ||
    context.isTrackPlayed(track.id) ||
    context.activeTrackId !== track.id
  ) {
    return accumulatedDuration;
  }
  const pos = context.currentTrackPosition;
  if (pos === undefined || pos <= 0) {
    return accumulatedDuration;
  }
  const full = context.calculateTrackDurationWithPause(track);
  return accumulatedDuration - Math.min(pos, full);
};

export const calculateAccumulatedDuration = (
  tracks: Track[],
  startIndex: number,
  endIndex: number,
  context: DividerCalculationContext,
): number => {
  const { mode, isTrackDisabled, isTrackPlayed } = context;

  let accumulatedDuration = 0;

  for (let i = startIndex; i <= endIndex && i < tracks.length; i++) {
    const track = tracks[i];

    if (isTrackDisabled(track.id)) {
      continue;
    }

    if (mode === 'session' && isTrackPlayed(track.id)) {
      continue;
    }

    const trackDuration = getSessionOrFullTrackDurationSeconds(context, track);
    accumulatedDuration += trackDuration;
  }

  return accumulatedDuration;
};

export interface DividerMarkers {
  markers: Map<string, number | null>;
  startPosition: StartPosition;
  nextEvenTime: number | null;
  plannedEndMarker: {
    trackId: string | null;
    time: number | null;
  } | null;
}

export const calculateDividerMarkers = (
  context: DividerCalculationContext & {
    showHourDividers: boolean;
    plannedEndTime?: number | null;
  },
): DividerMarkers => {
  const { tracks, hourDividerInterval, showHourDividers, plannedEndTime } = context;

  const markers = new Map<string, number | null>();
  let accumulatedDuration = 0;
  let nextEvenTime: number | null = null;
  let plannedEndMarker: { trackId: string | null; time: number | null } | null = null;

  if (!showHourDividers || hourDividerInterval <= 0 || tracks.length === 0) {
    return {
      markers,
      startPosition: {
        startFromIndex: 0,
        currentTimeOffset: 0,
        currentRealTime: null,
      },
      nextEvenTime: null,
      plannedEndMarker: null,
    };
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;
  const sessionPlannedEndTime =
    plannedEndTime !== null && plannedEndTime !== undefined && currentRealTime !== null
      ? getNextPlannedEndTime(plannedEndTime, currentRealTime)
      : plannedEndTime;

  if (context.mode === 'session' && currentRealTime !== null) {
    nextEvenTime = calculateNextEvenTime(currentRealTime, hourDividerInterval);
  }

  if (context.mode === 'preparation') {
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      if (context.isTrackDisabled(track.id)) {
        continue;
      }

      accumulatedDuration += context.calculateTrackDurationWithPause(track);

      const intervals = Math.floor(accumulatedDuration / hourDividerInterval);
      if (intervals > markers.size) {
        markers.set(track.id, null);
      }
    }
  } else {
    let previousTrack: Track | null = null;

    for (let i = startFromIndex; i < tracks.length; i++) {
      const track = tracks[i];

      if (context.isTrackDisabled(track.id)) {
        continue;
      }

      if (context.isTrackPlayed(track.id)) {
        continue;
      }

      const fullTrackDuration = context.calculateTrackDurationWithPause(track);
      accumulatedDuration = shiftAccumulatedForSessionCurrentTrackStart(
        context,
        track,
        accumulatedDuration,
      );

      if (currentRealTime !== null) {
        const trackStartRealTime = currentRealTime + accumulatedDuration * 1000;
        const trackEndRealTime = trackStartRealTime + fullTrackDuration * 1000;

        if (nextEvenTime !== null) {
          if (nextEvenTime >= trackStartRealTime && nextEvenTime <= trackEndRealTime) {
            markers.set(track.id, trackEndRealTime);
            nextEvenTime += hourDividerInterval * 1000;
          }
        }

        if (
          sessionPlannedEndTime !== null &&
          sessionPlannedEndTime !== undefined &&
          plannedEndMarker === null &&
          context.mode === 'session'
        ) {
          const position = findPlannedEndPosition(
            sessionPlannedEndTime,
            trackStartRealTime,
            trackEndRealTime,
            previousTrack,
            track,
          );
          if (position !== null) {
            plannedEndMarker = position;
          }
        }
      }

      previousTrack = track;

      accumulatedDuration += fullTrackDuration;
    }
  }

  return {
    markers,
    startPosition,
    nextEvenTime,
    plannedEndMarker,
  };
};

const padTimePart = (value: number): string => {
  return Math.max(0, Math.floor(value)).toString().padStart(2, '0');
};

export const formatTimeFromTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
};

export const formatTimeFromDuration = (durationSeconds: number): string => {
  const total = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}`;
};

export const calculateSimpleDividerMarkers = (
  tracks: Track[],
  hourDividerInterval: number,
): number[] => {
  const markers: number[] = [];
  let accumulatedDuration = 0;

  tracks.forEach((track, index) => {
    accumulatedDuration += track.duration || 0;
    const intervals = Math.floor(accumulatedDuration / hourDividerInterval);

    if (intervals > markers.length) {
      markers.push(index);
    }
  });

  return markers;
};

export const formatSimpleDividerLabel = (tracks: Track[], index: number): string => {
  const accumulatedDuration = tracks
    .slice(0, index + 1)
    .reduce((sum, track) => sum + (track.duration || 0), 0);

  return formatTimeFromDuration(accumulatedDuration);
};

export type HourDividerKind = 'planned-end' | 'queue-end' | 'interval';

export const getPriorityHourDividerKind = (
  hasPlannedEndDivider: boolean,
  hasQueueEndDivider: boolean,
  showIntervalDivider: boolean,
): HourDividerKind | null => {
  if (hasPlannedEndDivider) {
    return 'planned-end';
  }
  if (hasQueueEndDivider) {
    return 'queue-end';
  }
  if (showIntervalDivider) {
    return 'interval';
  }
  return null;
};

export const getHourDividerKindsAfterTrackRow = (
  hasPlannedEndDivider: boolean,
  hasQueueEndDivider: boolean,
  showIntervalDivider: boolean,
): HourDividerKind[] => {
  if (hasPlannedEndDivider && hasQueueEndDivider) {
    return ['planned-end', 'queue-end'];
  }
  const kind = getPriorityHourDividerKind(
    hasPlannedEndDivider,
    hasQueueEndDivider,
    showIntervalDivider,
  );
  return kind === null ? [] : [kind];
};

export const calculateTrackAnchorDividerPosition = <T extends { id: string }>(
  anchor: { trackId: string | null } | null,
  displayItems: Array<{ item: T }>,
  isPlayerTrack: (item: T) => boolean,
): number | null => {
  if (anchor === null) {
    return null;
  }

  if (anchor.trackId === null) {
    return -1;
  }

  const trackIdToDisplayIndex = new Map<string, number>();
  displayItems.forEach((di, idx) => {
    if (isPlayerTrack(di.item)) {
      trackIdToDisplayIndex.set(di.item.id, idx);
    }
  });

  const trackDisplayIndex = trackIdToDisplayIndex.get(anchor.trackId);
  return trackDisplayIndex !== undefined ? trackDisplayIndex : null;
};

export const calculatePlannedEndDividerPosition = <T extends { id: string }>(
  dividerMarkers: DividerMarkers,
  displayItems: Array<{ item: T }>,
  isPlayerTrack: (item: T) => boolean,
): number | null => {
  return calculateTrackAnchorDividerPosition(
    dividerMarkers.plannedEndMarker,
    displayItems,
    isPlayerTrack,
  );
};

export interface QueueEndMarker {
  trackId: string;
  sessionEndTimestamp: number | null;
  preparationDurationSeconds: number | null;
}

export const calculateQueueEndMarker = (
  context: DividerCalculationContext,
): QueueEndMarker | null => {
  const { tracks, mode } = context;
  if (tracks.length === 0) {
    return null;
  }

  if (mode === 'preparation') {
    let lastTrackId: string | null = null;
    let totalSeconds = 0;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (context.isTrackDisabled(track.id)) {
        continue;
      }
      totalSeconds += context.calculateTrackDurationWithPause(track);
      lastTrackId = track.id;
    }
    if (lastTrackId === null) {
      return null;
    }
    return {
      trackId: lastTrackId,
      sessionEndTimestamp: null,
      preparationDurationSeconds: totalSeconds,
    };
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;
  if (currentRealTime === null) {
    return null;
  }

  let accumulatedDuration = 0;
  let lastTrackId: string | null = null;

  for (let i = startFromIndex; i < tracks.length; i++) {
    const track = tracks[i];
    if (context.isTrackDisabled(track.id)) {
      continue;
    }
    if (context.isTrackPlayed(track.id)) {
      continue;
    }
    accumulatedDuration += getSessionOrFullTrackDurationSeconds(context, track);
    lastTrackId = track.id;
  }

  if (lastTrackId === null) {
    return null;
  }

  return {
    trackId: lastTrackId,
    sessionEndTimestamp: currentRealTime + accumulatedDuration * 1000,
    preparationDurationSeconds: null,
  };
};

export const calculateQueueEndDividerPosition = <T extends { id: string }>(
  queueEndMarker: QueueEndMarker | null,
  displayItems: Array<{ item: T }>,
  isPlayerTrack: (item: T) => boolean,
): number | null => {
  if (queueEndMarker === null) {
    return null;
  }
  return calculateTrackAnchorDividerPosition(
    { trackId: queueEndMarker.trackId },
    displayItems,
    isPlayerTrack,
  );
};

const findPlannedEndPosition = (
  plannedEndTime: number,
  trackStartRealTime: number,
  trackEndRealTime: number,
  previousTrack: Track | null,
  currentTrack: Track,
): { trackId: string | null; time: number | null } | null => {
  if (previousTrack === null && plannedEndTime < trackStartRealTime) {
    return {
      trackId: null,
      time: plannedEndTime,
    };
  }

  if (plannedEndTime >= trackStartRealTime && plannedEndTime <= trackEndRealTime) {
    if (plannedEndTime < trackEndRealTime) {
      return {
        trackId: previousTrack?.id ?? null,
        time: plannedEndTime,
      };
    }
    return {
      trackId: currentTrack.id,
      time: plannedEndTime,
    };
  }

  return null;
};

export const getNextPlannedEndTime = (plannedEndTime: number, currentTime: number): number => {
  const plannedTime = new Date(plannedEndTime);
  const currentDate = new Date(currentTime);
  const isSameLocalDate =
    plannedTime.getFullYear() === currentDate.getFullYear() &&
    plannedTime.getMonth() === currentDate.getMonth() &&
    plannedTime.getDate() === currentDate.getDate();

  if (isSameLocalDate) {
    return plannedEndTime;
  }

  const searchStart = Math.floor(currentTime / 60_000) * 60_000;
  const searchLimitMinutes = 8 * 24 * 60;

  for (let minuteOffset = 0; minuteOffset <= searchLimitMinutes; minuteOffset++) {
    const candidate = new Date(searchStart + minuteOffset * 60_000);
    candidate.setSeconds(plannedTime.getSeconds(), plannedTime.getMilliseconds());

    if (
      candidate.getTime() >= currentTime &&
      candidate.getHours() === plannedTime.getHours() &&
      candidate.getMinutes() === plannedTime.getMinutes()
    ) {
      return candidate.getTime();
    }
  }

  throw new RangeError('No upcoming local occurrence of planned end time');
};

export const calculateProjectedEndTime = (context: DividerCalculationContext): number | null => {
  const { mode } = context;

  if (mode !== 'session') {
    return null;
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;

  if (currentRealTime === null) {
    return null;
  }

  const remainingDuration = calculateAccumulatedDuration(
    context.tracks,
    startFromIndex,
    context.tracks.length - 1,
    context,
  );

  return currentRealTime + remainingDuration * 1000;
};

export const calculatePlannedEndMarker = (
  context: DividerCalculationContext,
  plannedEndTime: number | null,
): { trackId: string | null; time: number | null } | null => {
  const { mode, tracks } = context;

  if (mode !== 'session' || plannedEndTime === null || plannedEndTime === undefined) {
    return null;
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;

  if (currentRealTime === null) {
    return null;
  }

  const sessionPlannedEndTime = getNextPlannedEndTime(plannedEndTime, currentRealTime);

  let accumulatedDuration = 0;
  let previousTrack: Track | null = null;

  for (let i = startFromIndex; i < tracks.length; i++) {
    const track = tracks[i];

    if (context.isTrackDisabled(track.id)) {
      continue;
    }

    if (context.isTrackPlayed(track.id)) {
      continue;
    }

    const fullTrackDuration = context.calculateTrackDurationWithPause(track);
    accumulatedDuration = shiftAccumulatedForSessionCurrentTrackStart(
      context,
      track,
      accumulatedDuration,
    );

    const trackStartRealTime = currentRealTime + accumulatedDuration * 1000;
    const trackEndRealTime = trackStartRealTime + fullTrackDuration * 1000;

    const position = findPlannedEndPosition(
      sessionPlannedEndTime,
      trackStartRealTime,
      trackEndRealTime,
      previousTrack,
      track,
    );
    if (position !== null) {
      return position;
    }
    previousTrack = track;
    accumulatedDuration += fullTrackDuration;
  }

  return null;
};
