import { useCallback } from 'react';

import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';

import { useDemoPlayerStore, PlayerStatus } from '../stores/demoPlayerStore';
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
 * - FileBrowserView
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
    play,
    pause,
  } = useDemoPlayerStore();

  const activeTrackId = currentTrack?.id;

  /**
   * Start playback of a track
   * If it's a different track or playback has ended, loads the track first
   */
  const startPlayback = useCallback(
    async (track: Track) => {
      try {
        const isSameTrack = activeTrackId === track.id;
        if (!isSameTrack || playerStatus === 'ended') {
          await loadTrack(track, workspaceId);
        }
        await play();
      } catch (error) {
        logger.error('Failed to start track playback', error);
      }
    },
    [activeTrackId, playerStatus, loadTrack, play, workspaceId],
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
