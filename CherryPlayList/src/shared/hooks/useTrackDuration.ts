import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { Track } from '../../core/types/track';
import { logger } from '../utils/logger';

const DEFAULT_BATCH_SIZE = 5;

export interface UseAudioPathDurationsOptions {
  paths: string[];
  requestDuration: (path: string) => Promise<number>;
  onResolved: (path: string, duration: number) => void;
  onError?: (path: string, error: Error) => void;
  enabled?: boolean;
  shouldApply?: (path: string) => boolean;
  batchSize?: number;
}

export function useAudioPathDurations({
  paths,
  requestDuration,
  onResolved,
  onError,
  enabled = true,
  shouldApply,
  batchSize = DEFAULT_BATCH_SIZE,
}: UseAudioPathDurationsOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const pathsSnapshotRef = useRef(paths);

  useLayoutEffect(() => {
    pathsSnapshotRef.current = paths;
  });

  const loadPaths = useCallback(
    async (pathList: string[], externalSignal?: AbortSignal) => {
      const unique = [...new Set(pathList)];
      for (let i = 0; i < unique.length; i += batchSize) {
        const batch = unique.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (path) => {
            try {
              const duration = await requestDuration(path);
              if (externalSignal?.aborted) return;
              if (shouldApply && !shouldApply(path)) return;
              onResolved(path, duration);
            } catch (error) {
              if (!externalSignal?.aborted) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error(`Failed to load duration for ${path}`, err);
                onError?.(path, err);
              }
            }
          }),
        );
        if (externalSignal?.aborted) {
          break;
        }
      }
    },
    [batchSize, onError, onResolved, requestDuration, shouldApply],
  );

  const pathsKey = paths.join('\0');

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const list = pathsSnapshotRef.current;
    if (list.length === 0) {
      return;
    }
    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    void loadPaths(list, controller.signal);
    return () => {
      controller.abort();
    };
  }, [enabled, loadPaths, pathsKey]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { loadPaths };
}

interface UseTrackDurationOptions {
  tracks: Track[];
  isAudioFile: (path: string) => boolean;
  requestDuration: (path: string) => Promise<number>;
  resolveTrackById?: (id: string) => Track | undefined;
  onDurationResolved: (trackId: string, duration: number) => void;
  onError?: (path: string, error: Error) => void;
  batchSize?: number;
  /** When false, skips IPC duration requests (e.g. web demo). */
  enabled?: boolean;
}

export function useTrackDuration({
  tracks,
  isAudioFile,
  requestDuration,
  resolveTrackById,
  onDurationResolved,
  onError,
  batchSize = DEFAULT_BATCH_SIZE,
  enabled = true,
}: UseTrackDurationOptions) {
  const tracksRef = useRef(tracks);
  const resolveRef = useRef(resolveTrackById);

  useLayoutEffect(() => {
    tracksRef.current = tracks;
    resolveRef.current = resolveTrackById;
  });

  const paths = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tracks) {
      if (t.duration != null || !isAudioFile(t.path)) continue;
      if (seen.has(t.path)) continue;
      seen.add(t.path);
      out.push(t.path);
    }
    return out;
  }, [tracks, isAudioFile]);

  const shouldApply = useCallback((path: string) => {
    return tracksRef.current.some((t) => {
      if (t.path !== path || t.duration != null) return false;
      if (resolveRef.current) {
        const cur = resolveRef.current(t.id);
        return !!cur && cur.duration == null;
      }
      return true;
    });
  }, []);

  const onResolved = useCallback(
    (path: string, duration: number) => {
      for (const t of tracksRef.current) {
        if (t.path !== path || t.duration != null) continue;
        if (resolveRef.current) {
          const cur = resolveRef.current(t.id);
          if (!cur || cur.duration != null) continue;
        }
        onDurationResolved(t.id, duration);
      }
    },
    [onDurationResolved],
  );

  const { loadPaths } = useAudioPathDurations({
    paths,
    requestDuration,
    onResolved,
    onError,
    shouldApply,
    batchSize,
    enabled,
  });

  const loadDurationsForTracks = useCallback(
    (targets: Array<{ id: string; path: string }>, externalSignal?: AbortSignal) => {
      const pathList = targets.map((t) => t.path);
      void loadPaths(pathList, externalSignal);
    },
    [loadPaths],
  );

  return {
    loadDurationsForTracks,
  };
}
