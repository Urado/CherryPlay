
import {
  isProjectGroup,
  ProjectItem,
  ActionAfterTrack,
  type ProgramTrack,
} from '@core/types/project';
import { useProjectStore } from '@shared/stores';
import { useCallback } from 'react';

interface UsePlayerStateHelpersOptions {
  allTracks: ProgramTrack[];
  activePlayerTrackId: string | null | undefined;
  getItemPath: (id: string) => string[];
  findItemById: (id: string) => ProjectItem | null;
  isTrackActive: (trackId: string) => boolean;
}

export const usePlayerStateHelpers = (options: UsePlayerStateHelpersOptions) => {
  const { allTracks, activePlayerTrackId, getItemPath, findItemById, isTrackActive } = options;

  const { getTrackSettings, getGroupSettings, settings } = useProjectStore();
  const { defaultActionAfterTrack, defaultPauseBetweenTracks } = settings;

  const getEffectiveTrackSettings = useCallback(
    (trackId: string) => {
      const trackSettings = getTrackSettings(trackId);

      let effectiveActionAfterTrack: ActionAfterTrack = defaultActionAfterTrack;
      let effectivePauseBetweenTracks: number = defaultPauseBetweenTracks;

      if (trackSettings.actionAfterTrack !== null && trackSettings.actionAfterTrack !== undefined) {
        effectiveActionAfterTrack = trackSettings.actionAfterTrack;
        effectivePauseBetweenTracks =
          trackSettings.pauseBetweenTracks !== null &&
          trackSettings.pauseBetweenTracks !== undefined
            ? trackSettings.pauseBetweenTracks
            : defaultPauseBetweenTracks;
      } else {
        const path = getItemPath(trackId);
        let foundInGroup = false;

        for (let i = path.length - 1; i >= 0; i--) {
          const itemId = path[i];
          const item = findItemById(itemId);
          if (item && isProjectGroup(item)) {
            const groupSettings = getGroupSettings(itemId);
            if (
              groupSettings.actionAfterTrack !== null &&
              groupSettings.actionAfterTrack !== undefined
            ) {
              effectiveActionAfterTrack = groupSettings.actionAfterTrack;
              effectivePauseBetweenTracks =
                groupSettings.pauseBetweenTracks !== null &&
                groupSettings.pauseBetweenTracks !== undefined
                  ? groupSettings.pauseBetweenTracks
                  : defaultPauseBetweenTracks;
              foundInGroup = true;
              break;
            }
          }
        }

        if (!foundInGroup) {
          effectiveActionAfterTrack = defaultActionAfterTrack;
          effectivePauseBetweenTracks =
            trackSettings.pauseBetweenTracks !== null &&
            trackSettings.pauseBetweenTracks !== undefined
              ? trackSettings.pauseBetweenTracks
              : defaultPauseBetweenTracks;
        }
      }

      return {
        actionAfterTrack: effectiveActionAfterTrack,
        pauseBetweenTracks: effectivePauseBetweenTracks,
      };
    },
    [
      getTrackSettings,
      getGroupSettings,
      getItemPath,
      findItemById,
      defaultActionAfterTrack,
      defaultPauseBetweenTracks,
    ],
  );

  const calculateTrackDurationWithPause = useCallback(
    (track: ProgramTrack, includePause: boolean = true): number => {
      let duration = track.duration || 0;
      if (includePause) {
        const settings = getEffectiveTrackSettings(track.id);
        if (settings.actionAfterTrack === 'pauseAndNext') {
          duration += settings.pauseBetweenTracks || 0;
        }
      }
      return duration;
    },
    [getEffectiveTrackSettings],
  );

  const getNextActiveTrack = useCallback((): ProgramTrack | null => {
    const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
    if (currentIndex === -1) {
      for (let i = 0; i < allTracks.length; i++) {
        const track = allTracks[i];
        if (isTrackActive(track.id)) {
          return track;
        }
      }
      return null;
    }

    for (let i = currentIndex + 1; i < allTracks.length; i++) {
      const track = allTracks[i];
      if (isTrackActive(track.id)) {
        return track;
      }
    }

    return null;
  }, [allTracks, activePlayerTrackId, isTrackActive]);

  return {
    getEffectiveTrackSettings,
    calculateTrackDurationWithPause,
    getNextActiveTrack,
  };
};
