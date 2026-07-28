import { useCallback, useMemo } from 'react';

import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';

import { isLocalFilePlaybackBlocked } from '../demo/guardPlayback';
import { useLayoutStore, useSettingsStore } from '../stores';
import { useDemoPlayerStore, PlayerStatus } from '../stores/demoPlayerStore';
import { collectWorkspaceTypes } from '../utils/layoutWorkspaceOperations';
import { logger } from '../utils/logger';

/**
 * Options for usePlaybackPreview hook
 */
export interface UsePlaybackPreviewOptions {
  /** Workspace ID for tracking the source of playback */
  workspaceId: WorkspaceId;
}

/**
 * Return type for usePlaybackPreview hook
 */
export interface UsePlaybackPreviewReturn {
  /** ID of the currently active track */
  activeTrackId: string | undefined;
  /** Current player status */
  playerStatus: PlayerStatus;
  /** Start playback of a track (loads if different track or ended) */
  startPlayback: (track: Track) => Promise<void>;
  /** Pause current playback */
  pausePlayback: () => void;
  /** Check if a track is the active track */
  isActive: (trackId: string) => boolean;
  /** Check if a track is currently playing */
  isPlaying: (trackId: string) => boolean;
}

/**
 * usePlaybackPreview - Unified hook for demo player preview playback
 *
 * Provides consistent playback preview behavior across all workspace views:
 * - PlaylistView
 * - CollectionView
 *
 * Handles loading tracks, playing, pausing, and checking playback state.
 *
 * @example
 * ```tsx
 * const { startPlayback, pausePlayback, isActive, isPlaying } = usePlaybackPreview({
 *   workspaceId: 'playlist',
 * });
 *
 * // In component
 * <PlayButton
 *   isPlaying={isPlaying(track.id)}
 *   onPlay={() => startPlayback(track)}
 *   onPause={pausePlayback}
 * />
 * ```
 */
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

  /**
   * Start playback of a track
   * If it's a different track or playback has ended, loads the track first
   */
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
            error: 'Воспроизведение невозможно',
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
          // Keep demo UI open with explicit blocked messaging (same as local-file blocked path).
          useDemoPlayerStore.setState({
            error: 'Воспроизведение невозможно',
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

  /**
   * Pause current playback
   */
  const pausePlayback = useCallback(() => {
    pause();
  }, [pause]);

  /**
   * Check if a track is the currently active track
   */
  const isActive = useCallback(
    (trackId: string): boolean => {
      return activeTrackId === trackId;
    },
    [activeTrackId],
  );

  /**
   * Check if a track is currently playing
   */
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
