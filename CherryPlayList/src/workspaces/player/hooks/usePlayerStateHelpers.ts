import { useCallback } from 'react';

import { isProjectGroup, ProjectItem, ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';
import { useProjectStore } from '@shared/stores';

interface UsePlayerStateHelpersOptions {
  allTracks: Track[];
  activePlayerTrackId: string | null | undefined;
  getItemPath: (id: string) => string[];
  findItemById: (id: string) => ProjectItem | null;
  isTrackActive: (trackId: string) => boolean;
}

/**
 * Хук для хелперов состояния плеера
 * Объединяет логику: getEffectiveTrackSettings, calculateTrackDurationWithPause, getNextActiveTrack
 */
export function usePlayerStateHelpers(options: UsePlayerStateHelpersOptions) {
  const { allTracks, activePlayerTrackId, getItemPath, findItemById, isTrackActive } = options;

  const { getTrackSettings, getGroupSettings, settings } = useProjectStore();
  const { defaultActionAfterTrack, defaultPauseBetweenTracks } = settings;

  /**
   * Получает эффективные настройки трека с учетом иерархии
   * Приоритет: трек > группа > большая группа > глобальные
   */
  const getEffectiveTrackSettings = useCallback(
    (trackId: string) => {
      const trackSettings = getTrackSettings(trackId);

      // Определяем actionAfterTrack с учетом иерархии
      let effectiveActionAfterTrack: ActionAfterTrack = defaultActionAfterTrack;
      let effectivePauseBetweenTracks: number = defaultPauseBetweenTracks;

      // 1. Проверяем настройки трека
      if (trackSettings.actionAfterTrack !== null && trackSettings.actionAfterTrack !== undefined) {
        effectiveActionAfterTrack = trackSettings.actionAfterTrack;
        // Если у трека есть actionAfterTrack, используем pauseBetweenTracks из трека или глобальные
        effectivePauseBetweenTracks =
          trackSettings.pauseBetweenTracks !== null &&
          trackSettings.pauseBetweenTracks !== undefined
            ? trackSettings.pauseBetweenTracks
            : defaultPauseBetweenTracks;
      } else {
        // 2. Ищем настройки в группах (от ближайшей к дальней)
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
              // Используем pauseBetweenTracks из группы или глобальные
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

        // 3. Если не нашли в группах, используем глобальные настройки
        if (!foundInGroup) {
          effectiveActionAfterTrack = defaultActionAfterTrack;
          // Если у трека есть pauseBetweenTracks, используем его, иначе глобальные
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

  /**
   * Рассчитывает длительность трека с учетом паузы
   */
  const calculateTrackDurationWithPause = useCallback(
    (track: Track, includePause: boolean = true): number => {
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

  /**
   * Получает следующий активный трек
   */
  const getNextActiveTrack = useCallback((): Track | null => {
    const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
    if (currentIndex === -1) {
      // Если текущего трека нет, ищем первый активный трек
      for (let i = 0; i < allTracks.length; i++) {
        const track = allTracks[i];
        if (isTrackActive(track.id)) {
          return track;
        }
      }
      return null;
    }

    // Ищем следующий активный трек (не проигранный, не отключенный)
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
}
