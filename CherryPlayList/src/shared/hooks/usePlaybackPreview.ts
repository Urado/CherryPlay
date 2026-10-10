
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { useCallback, useMemo } from 'react';

import { isDemoSharedOutputConflictError } from '../demo/demoSharedOutputConflict';
import { isLocalFilePlaybackBlocked } from '../demo/guardPlayback';
import { DEMO_UNAVAILABLE_MESSAGE } from '../platform/demoUnavailable';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
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

export const usePlaybackPreview = ({
  workspaceId,
}: UsePlaybackPreviewOptions): UsePlaybackPreviewReturn => {
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
        let loadGeneration: number | undefined;
        if (!isSameTrack || playerStatus === 'ended') {
          loadGeneration = await loadTrack(track, workspaceId, true);
        }

        const { isDisabled, error, status } = useDemoPlayerStore.getState();
        if (isDisabled) {
          pause();
          if (isDemoSharedOutputConflictError(error) || status === 'error') {
            useDemoPlayerStore.setState({
              error: null,
              status: status === 'error' ? 'paused' : status,
            });
          }
          return;
        }

        if (
          loadGeneration !== undefined &&
          !useDemoPlayerStore
            .getState()
            .shouldAutoPlayTrack(track.id, workspaceId, loadGeneration)
        ) {
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
      pause,
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
};
