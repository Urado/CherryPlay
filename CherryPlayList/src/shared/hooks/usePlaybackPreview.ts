import { useCallback, useMemo } from 'react';

import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';

import { isLocalFilePlaybackBlocked } from '../demo/guardPlayback';
import { DEMO_UNAVAILABLE_MESSAGE } from '../platform/demoUnavailable';
import { useLayoutStore, useSettingsStore } from '../stores';
import { useDemoPlayerStore, PlayerStatus } from '../stores/demoPlayerStore';
import { collectWorkspaceTypes } from '../utils/layoutWorkspaceOperations';
import { logger } from '../utils/logger';

export interface UsePlaybackPreviewOptions {
  workspaceId: WorkspaceId;
}

export interface UsePlaybackPreviewReturn {
  activeTrackId: string | undefined;
  playerStatus: PlayerStatus;
  startPlayback: (track: Track) => Promise<void>;
  pausePlayback: () => void;
  isActive: (trackId: string) => boolean;
  isPlaying: (trackId: string) => boolean;
}

export function usePlaybackPreview({
  workspaceId,
}: UsePlaybackPreviewOptions): UsePlaybackPreviewReturn {
  const {
    currentTrack,
    status: playerStatus,
    loadTrack,
    setActiveTrack,
    play,
    pause,
  } = useDemoPlayerStore();
  const layout = useLayoutStore((state) => state.layout);
  const setDemoPlayerFloatingOpen = useSettingsStore((state) => state.setDemoPlayerFloatingOpen);
  const hasDemoPlayerWorkspace = useMemo(
    () => collectWorkspaceTypes(layout.rootZone).has('demo-player'),
    [layout],
  );

  const activeTrackId = currentTrack?.id;

  const startPlayback = useCallback(
    async (track: Track) => {
      const shouldOpenFloatingOnAttempt = !hasDemoPlayerWorkspace;
      try {
        if (shouldOpenFloatingOnAttempt) {
          setDemoPlayerFloatingOpen(true);
        }

        if (isLocalFilePlaybackBlocked()) {
          setActiveTrack(track, workspaceId);
          useDemoPlayerStore.setState({
            error: DEMO_UNAVAILABLE_MESSAGE,
            status: 'error',
          });
          return;
        }

        const isSameTrack = activeTrackId === track.id;
        if (!isSameTrack || playerStatus === 'ended') {
          await loadTrack(track, workspaceId);
        }

        const { isDisabled } = useDemoPlayerStore.getState();
        if (isDisabled) {
          useDemoPlayerStore.setState({
            error: 'Воспроизведение невозможно: используется то же устройство, что и плеер',
            status: 'error',
          });
          return;
        }

        await play();
      } catch (error) {
        if (shouldOpenFloatingOnAttempt) {
          const { currentTrack: latestTrack, status: latestStatus } = useDemoPlayerStore.getState();
          const hasActiveDemoSession =
            latestTrack !== null || latestStatus === 'playing' || latestStatus === 'loading';

          if (!hasActiveDemoSession) {
            setDemoPlayerFloatingOpen(false);
          }
        }
        logger.error('Failed to start track playback', error);
      }
    },
    [
      activeTrackId,
      playerStatus,
      loadTrack,
      play,
      setActiveTrack,
      setDemoPlayerFloatingOpen,
      hasDemoPlayerWorkspace,
      workspaceId,
    ],
  );

  const pausePlayback = useCallback(() => {
    pause();
  }, [pause]);

  const isActive = useCallback(
    (trackId: string): boolean => {
      return activeTrackId === trackId;
    },
    [activeTrackId],
  );

  const isPlaying = useCallback(
    (trackId: string): boolean => {
      return activeTrackId === trackId && playerStatus === 'playing';
    },
    [activeTrackId, playerStatus],
  );

  return {
    activeTrackId,
    playerStatus,
    startPlayback,
    pausePlayback,
    isActive,
    isPlaying,
  };
}
