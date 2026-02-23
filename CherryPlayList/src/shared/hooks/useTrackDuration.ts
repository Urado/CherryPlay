import { useCallback, useEffect, useRef } from 'react';

import { Track } from '../../core/types/track';
import { logger } from '../utils/logger';

const DEFAULT_BATCH_SIZE = 5;

interface TrackDurationOptions {
  tracks: Track[];
  isAudioFile: (path: string) => boolean;
  requestDuration: (path: string) => Promise<number>;
  /** Optional: skip updating if track was removed or already has duration (e.g. resolveTrackById) */
  resolveTrackById?: (id: string) => Track | undefined;
  onDurationResolved: (trackId: string, duration: number) => void;
  batchSize?: number;
}

export function useTrackDuration({
  tracks,
  isAudioFile,
  requestDuration,
  resolveTrackById,
  onDurationResolved,
  batchSize = DEFAULT_BATCH_SIZE,
}: TrackDurationOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadDurationsForTracks = useCallback(
    async (targetTracks: Array<{ id: string; path: string }>, externalSignal?: AbortSignal) => {
      for (let i = 0; i < targetTracks.length; i += batchSize) {
        const batch = targetTracks.slice(i, i + batchSize);
        const tasks = batch.map(async (track) => {
          try {
            const duration = await requestDuration(track.path);
            if (externalSignal?.aborted) return;

            if (resolveTrackById) {
              const current = resolveTrackById(track.id);
              if (!current || current.duration != null) return;
            }
            onDurationResolved(track.id, duration);
          } catch (error) {
            if (!externalSignal?.aborted) {
              logger.error(`Failed to load duration for ${track.path}`, error);
            }
          }
        });
        await Promise.all(tasks);
        if (externalSignal?.aborted) {
          break;
        }
      }
    },
    [batchSize, onDurationResolved, requestDuration, resolveTrackById],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    const targets = tracks.filter((track) => !track.duration && isAudioFile(track.path));
    if (targets.length > 0) {
      const targetList = targets.map((track) => ({ id: track.id, path: track.path }));
      loadDurationsForTracks(targetList, controller.signal);
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
