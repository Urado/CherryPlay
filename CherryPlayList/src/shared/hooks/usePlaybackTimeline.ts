import { useCallback, useState } from 'react';

export interface UsePlaybackTimelineOptions {
  readonly position: number;
  readonly duration: number;
  readonly disabled: boolean;
  readonly seek: (positionSeconds: number) => void;
  /** Called after the user commits a seek (e.g. resume when ended). */
  readonly onSeekCommitted?: (positionSeconds: number) => void;
}

/**
 * Controlled range input for playback timelines.
 * Keeps a local scrub value while dragging/clicking so frequent engine
 * position updates do not reset the thumb before seek commits.
 */
export function usePlaybackTimeline(options: UsePlaybackTimelineOptions) {
  const { position, duration, disabled, seek, onSeekCommitted } = options;
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const safePosition = Number.isFinite(position) ? Math.max(0, position) : 0;
  const resolvedDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const displayPosition = isScrubbing ? scrubValue : safePosition;

  const beginScrub = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsScrubbing(true);
    setScrubValue(safePosition);
  }, [disabled, safePosition]);

  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      const value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) {
        return;
      }
      setScrubValue(value);
      seek(value);
    },
    [disabled, seek],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) {
        setIsScrubbing(false);
        return;
      }
      const value = parseFloat(event.target.value);
      if (Number.isFinite(value)) {
        seek(value);
        onSeekCommitted?.(value);
      }
      setIsScrubbing(false);
    },
    [disabled, onSeekCommitted, seek],
  );

  return {
    displayPosition,
    resolvedDuration,
    beginScrub,
    handleInput,
    handleChange,
  };
}
