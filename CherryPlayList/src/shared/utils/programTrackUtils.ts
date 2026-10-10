import {
  ActionAfterTrack,
  isProjectGroup,
  isProjectTrack,
  ProjectGroupSettings,
  ProjectItem,
  ProjectSettings,
  ProjectTrackSettings,
  type EmptyTrack,
  type ProgramTrack,
} from '@core/types/project';
import type { PlaybackWireStatus } from '@shared/contracts/playbackState';

export const DEFAULT_EMPTY_TRACK_NAME = 'Пустой трек';
export const DEFAULT_EMPTY_TRACK_DURATION_SEC = 60;

export const createEmptyTrack = (params?: {
  name?: string;
  duration?: number;
  id?: string;
}): EmptyTrack => {
  const duration =
    typeof params?.duration === 'number' && Number.isFinite(params.duration) && params.duration > 0
      ? params.duration
      : DEFAULT_EMPTY_TRACK_DURATION_SEC;
  return {
    id: params?.id ?? '',
    kind: 'emptyTrack',
    name: params?.name?.trim() ? params.name.trim() : DEFAULT_EMPTY_TRACK_NAME,
    duration,
  };
};

export const isTrackHiddenFromSite = (
  trackId: string,
  trackSettings: Map<string, ProjectTrackSettings>,
): boolean => trackSettings.get(trackId)?.hiddenFromSite === true;

export const filterProjectItemsForSite = (
  items: ProjectItem[],
  trackSettings: Map<string, ProjectTrackSettings>,
): ProjectItem[] => {
  const filtered: ProjectItem[] = [];
  for (const item of items) {
    if (isProjectGroup(item)) {
      const nested = filterProjectItemsForSite(item.items, trackSettings);
      if (nested.length > 0) {
        filtered.push({ ...item, items: nested });
      }
      continue;
    }
    if (!isTrackHiddenFromSite(item.id, trackSettings)) {
      filtered.push(item);
    }
  }
  return filtered;
};

export const collectProgramTracksInOrder = (items: ProjectItem[]): ProgramTrack[] => {
  const tracks: ProgramTrack[] = [];
  for (const item of items) {
    if (isProjectTrack(item)) {
      tracks.push(item);
    } else if (isProjectGroup(item)) {
      tracks.push(...collectProgramTracksInOrder(item.items));
    }
  }
  return tracks;
};

export const getEffectiveTrackSettingsForProject = (
  trackId: string,
  params: {
    settings: ProjectSettings;
    trackSettings: Map<string, ProjectTrackSettings>;
    groupSettings: Map<string, ProjectGroupSettings>;
    getItemPath: (id: string) => string[];
    findItemById: (id: string) => ProjectItem | null;
  },
): { actionAfterTrack: ActionAfterTrack; pauseBetweenTracks: number } => {
  const { settings, trackSettings, groupSettings, getItemPath, findItemById } = params;
  const trackLevel = trackSettings.get(trackId) ?? {};
  const { defaultActionAfterTrack, defaultPauseBetweenTracks } = settings;

  let effectiveActionAfterTrack: ActionAfterTrack = defaultActionAfterTrack;
  let effectivePauseBetweenTracks = defaultPauseBetweenTracks;

  if (
    trackLevel.actionAfterTrack !== null &&
    trackLevel.actionAfterTrack !== undefined
  ) {
    effectiveActionAfterTrack = trackLevel.actionAfterTrack;
    effectivePauseBetweenTracks =
      trackLevel.pauseBetweenTracks !== null && trackLevel.pauseBetweenTracks !== undefined
        ? trackLevel.pauseBetweenTracks
        : defaultPauseBetweenTracks;
  } else {
    const path = getItemPath(trackId);
    let foundInGroup = false;
    for (let i = path.length - 1; i >= 0; i--) {
      const pathItemId = path[i];
      const pathItem = findItemById(pathItemId);
      if (pathItem && isProjectGroup(pathItem)) {
        const groupLevel = groupSettings.get(pathItemId) ?? {};
        if (
          groupLevel.actionAfterTrack !== null &&
          groupLevel.actionAfterTrack !== undefined
        ) {
          effectiveActionAfterTrack = groupLevel.actionAfterTrack;
          effectivePauseBetweenTracks =
            groupLevel.pauseBetweenTracks !== null &&
            groupLevel.pauseBetweenTracks !== undefined
              ? groupLevel.pauseBetweenTracks
              : defaultPauseBetweenTracks;
          foundInGroup = true;
          break;
        }
      }
    }
    if (!foundInGroup) {
      effectiveActionAfterTrack = defaultActionAfterTrack;
      effectivePauseBetweenTracks =
        trackLevel.pauseBetweenTracks !== null && trackLevel.pauseBetweenTracks !== undefined
          ? trackLevel.pauseBetweenTracks
          : defaultPauseBetweenTracks;
    }
  }

  return {
    actionAfterTrack: effectiveActionAfterTrack,
    pauseBetweenTracks: effectivePauseBetweenTracks,
  };
};

export const calculateProgramTimelineDuration = (
  orderedTracks: ProgramTrack[],
  params: {
    isTrackDisabled: (trackId: string) => boolean;
    getEffectiveTrackSettings: (trackId: string) => {
      actionAfterTrack: ActionAfterTrack;
      pauseBetweenTracks: number;
    };
  },
): number => {
  let total = 0;
  for (let i = 0; i < orderedTracks.length; i++) {
    const track = orderedTracks[i];
    if (params.isTrackDisabled(track.id)) {
      continue;
    }
    total += track.duration ?? 0;
    if (i < orderedTracks.length - 1) {
      const trackSettings = params.getEffectiveTrackSettings(track.id);
      if (trackSettings.actionAfterTrack === 'pauseAndNext') {
        total += trackSettings.pauseBetweenTracks;
      }
    }
  }
  return total;
};

export const findPreviousVisibleProgramTrack = (
  orderedTracks: ProgramTrack[],
  currentTrackId: string,
  trackSettings: Map<string, ProjectTrackSettings>,
): ProgramTrack | null => {
  const currentIndex = orderedTracks.findIndex((track) => track.id === currentTrackId);
  if (currentIndex <= 0) {
    return null;
  }
  for (let i = currentIndex - 1; i >= 0; i--) {
    const candidate = orderedTracks[i];
    if (!isTrackHiddenFromSite(candidate.id, trackSettings)) {
      return candidate;
    }
  }
  return null;
};

export const resolveGuestSitePlaybackPresentation = (params: {
  currentTrackId: string | null;
  status: PlaybackWireStatus;
  position: number;
  duration: number;
  orderedTracks: ProgramTrack[];
  trackSettings: Map<string, ProjectTrackSettings>;
}): {
  currentTrackId: string | null;
  status: PlaybackWireStatus;
  position: number;
  duration: number;
} => {
  const { currentTrackId, status, position, duration, orderedTracks, trackSettings } = params;
  if (!currentTrackId || !isTrackHiddenFromSite(currentTrackId, trackSettings)) {
    return { currentTrackId, status, position, duration };
  }

  const previousVisible = findPreviousVisibleProgramTrack(
    orderedTracks,
    currentTrackId,
    trackSettings,
  );
  if (!previousVisible) {
    return { currentTrackId: null, status: 'paused', position: 0, duration: 0 };
  }

  const previousDuration = previousVisible.duration ?? 0;
  return {
    currentTrackId: previousVisible.id,
    status: 'paused',
    position: previousDuration,
    duration: previousDuration,
  };
};
