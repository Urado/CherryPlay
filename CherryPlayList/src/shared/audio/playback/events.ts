import type { PlaybackEngineStatus } from './types';

/**
 * Typed events emitted by a {@link PlaybackEngine} implementation.
 *
 * Store/session layers subscribe to keep UI in sync with playback truth.
 * Queue navigation, shuffle/repeat, and `onTrackEnded` policy are **not**
 * engine events — they live in the store.
 */
export interface PlaybackEngineEventMap {
  /** Playback status transitioned (idle, loading, playing, paused, etc.). */
  statusChanged: PlaybackEngineStatus;
  /** Current position in seconds. */
  positionChanged: number;
  /** Media duration in seconds (after metadata is available). */
  durationChanged: number;
  /** Current track reached natural end. Store decides whether to call `next()`. */
  ended: void;
  /** Unrecoverable playback or load failure. */
  error: string;
  /** Output device id changed (`null` = system default). */
  outputDeviceChanged: string | null;
}

/** Union of event names on {@link PlaybackEngineEventMap}. */
export type PlaybackEngineEventName = keyof PlaybackEngineEventMap;

/** Listener for a single event type. */
export type PlaybackEngineListener<K extends PlaybackEngineEventName> = (
  payload: PlaybackEngineEventMap[K],
) => void;

/**
 * Disposer returned from {@link PlaybackEngine.subscribe}.
 * Call once to remove the listener; idempotent after first call.
 */
export type PlaybackEngineSubscription = () => void;

/**
 * Broad listener invoked for every event (optional pattern for store wiring).
 */
export type PlaybackEngineAnyListener = <K extends PlaybackEngineEventName>(
  event: K,
  payload: PlaybackEngineEventMap[K],
) => void;
