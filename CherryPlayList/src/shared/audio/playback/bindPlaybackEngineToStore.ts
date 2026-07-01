import type { StorePlaybackStatus } from '../../contracts/storePlaybackStatus';

import type { PlaybackEngine } from './PlaybackEngine';
import type { PlaybackEngineStatus } from './types';

export type { StorePlaybackStatus };

export function mapEngineStatusToStoreStatus(status: PlaybackEngineStatus): StorePlaybackStatus {
  switch (status) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'loading':
      return 'loading';
    case 'buffering':
      return 'buffering';
    case 'ended':
      return 'ended';
    case 'error':
      return 'error';
    case 'idle':
    default:
      return 'idle';
  }
}

export interface PlaybackEngineStoreBindings {
  readonly onStatusChanged: (status: StorePlaybackStatus) => void;
  readonly onPositionChanged: (positionSeconds: number) => void;
  readonly onDurationChanged: (durationSeconds: number) => void;
  readonly onEnded: () => void;
  readonly onError: (message: string) => void;
}

/**
 * Subscribes store callbacks to engine events (hybrid state model).
 * @returns Disposer — call on store teardown.
 */
export function bindPlaybackEngineToStore(
  engine: PlaybackEngine,
  bindings: PlaybackEngineStoreBindings,
): () => void {
  const subscriptions = [
    engine.subscribe('statusChanged', (status) => {
      bindings.onStatusChanged(mapEngineStatusToStoreStatus(status));
    }),
    engine.subscribe('positionChanged', (position) => {
      bindings.onPositionChanged(position);
    }),
    engine.subscribe('durationChanged', (duration) => {
      bindings.onDurationChanged(duration);
    }),
    engine.subscribe('ended', () => {
      bindings.onEnded();
    }),
    engine.subscribe('error', (message) => {
      bindings.onError(message);
    }),
  ];

  return () => {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
  };
}
