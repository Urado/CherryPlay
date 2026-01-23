import { useCallback, useEffect, useRef } from 'react';

import { Track } from '../../core/types/track';
import { logger } from '../utils/logger';

const DEFAULT_BATCH_SIZE = 5;

interface TrackDurationOptions {
  tracks: Track[];
  isAudioFile: (path: string) => boolean;
  requestDuration: (path: string) => Promise<number>;
  resolveTrackByPath: (path: string) => Track | undefined;
  onDurationResolved: (trackId: string, duration: number) => void;
  batchSize?: number;
}

export function useTrackDuration({
  tracks,
  isAudioFile,
  requestDuration,
  resolveTrackByPath,
  onDurationResolved,
  batchSize = DEFAULT_BATCH_SIZE,
}: TrackDurationOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadDurationsForTracks = useCallback(
    async (paths: string[], externalSignal?: AbortSignal) => {
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        const tasks = batch.map(async (path) => {
          // Check if track exists before requesting duration
          const track = resolveTrackByPath(path);
          if (!track || track.duration) {
            return;
          }

          // Store track ID to verify it hasn't changed after async operation
          const trackId = track.id;

          try {
            const duration = await requestDuration(path);

            // Verify track still exists and hasn't been deleted or modified
            // This prevents race condition where track is deleted before duration request completes
            const latestTrack = resolveTrackByPath(path);
            if (
              !latestTrack ||
              latestTrack.id !== trackId ||
              latestTrack.duration ||
              externalSignal?.aborted
            ) {
              return;
            }
            onDurationResolved(latestTrack.id, duration);
          } catch (error) {
            if (!externalSignal?.aborted) {
              logger.error(`Failed to load duration for ${path}`, error);
            }
          }
        });
        await Promise.all(tasks);
        if (externalSignal?.aborted) {
          break;
        }
      }
    },
    [batchSize, onDurationResolved, requestDuration, resolveTrackByPath],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    const targets = tracks.filter((track) => !track.duration && isAudioFile(track.path));
    if (targets.length > 0) {
      const paths = targets.map((track) => track.path);
      loadDurationsForTracks(paths, controller.signal);
    }

    return () => {
      controller.abort();
    };
  }, [isAudioFile, loadDurationsForTracks, tracks]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    loadDurationsForTracks,
  };
}
