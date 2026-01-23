import { useMemo } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { useDemoPlayerStore, usePlayerAudioStore, useProjectStore } from '@shared/stores';

/**
 * Интерфейс для работы с плеером независимо от режима
 */
export interface PlayerModeInterface {
  currentTrack: Track | null;
  status: string;
  loadTrack: (track: Track, workspaceId?: WorkspaceId) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
}

/**
 * Хук для абстракции режимов preparation/session
 * Возвращает единый интерфейс для работы с плеером в зависимости от текущего режима
 */
export function usePlayerMode(): PlayerModeInterface {
  const mode = useProjectStore((state) => state.sessionState.mode);
  const isPreparationMode = mode === 'preparation';

  // Демо-плеер для режима подготовки
  const {
    currentTrack: demoCurrentTrack,
    status: demoStatus,
    loadTrack: loadDemoTrack,
    play: playDemo,
    pause: pauseDemo,
  } = useDemoPlayerStore();

  // Плеер для режима сессии
  const {
    currentTrack: playerCurrentTrack,
    status: playerStatus,
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    pause: pausePlayer,
  } = usePlayerAudioStore();

  return useMemo(() => {
    if (isPreparationMode) {
      return {
        currentTrack: demoCurrentTrack,
        status: demoStatus,
        loadTrack: async (track: Track, workspaceId?: WorkspaceId) => {
          await loadDemoTrack(track, workspaceId || DEFAULT_PLAYER_WORKSPACE_ID);
        },
        play: playDemo,
        pause: pauseDemo,
      };
    } else {
      return {
        currentTrack: playerCurrentTrack,
        status: playerStatus,
        loadTrack: async (track: Track) => {
          await loadPlayerTrack(track);
        },
        play: playPlayer,
        pause: pausePlayer,
      };
    }
  }, [
    isPreparationMode,
    demoCurrentTrack,
    demoStatus,
    loadDemoTrack,
    playDemo,
    pauseDemo,
    playerCurrentTrack,
    playerStatus,
    loadPlayerTrack,
    playPlayer,
    pausePlayer,
  ]);
}
