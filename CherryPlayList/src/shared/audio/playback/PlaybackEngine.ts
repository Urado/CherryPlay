import type {
  PlaybackEngineEventName,
  PlaybackEngineListener,
  PlaybackEngineSubscription,
} from './events';
import type { PlaybackSnapshot, PlaybackSource } from './types';

/**
 * Pluggable playback backend for a **single** audio stream.
 *
 * ## Playlist boundary
 *
 * This interface intentionally excludes queue management: no `next()`, `previous()`,
 * shuffle, repeat, autoplay-on-ended, pause timers, or `Track` metadata. Those
 * responsibilities stay in `playerAudioStore` / `demoPlayerStore` (session layer).
 * On `ended`, the store decides whether to advance the queue.
 *
 * ## Hybrid state model
 *
 * - **Engine** = source of truth for real playback: status, position, duration,
 *   buffering, ended, error, volume, output device.
 * - **Store** = source of truth for app/session: current track metadata, queue,
 *   UI flags, demo disable policy, EQ preset selection.
 *
 * Stores should call `subscribe()` and mirror engine fields into Zustand state;
 * they must not duplicate HTMLAudio event wiring after migration.
 *
 * ## Two-instance pattern
 *
 * {@link createPlaybackEngine} and {@link createPlaybackEnginePair} each return **new**
 * objects — `dispose()` on one instance does not affect another. The desktop app does
 * not call the factory per store; it imports process-lifetime shared instances from
 * `playbackEngines.ts` (`mainPlaybackEngine`, `demoPlaybackEngine`) created once via
 * `createPlaybackEnginePair()`. Main and demo may play simultaneously on different
 * output devices. Mutual exclusion (demo disable during session) is enforced by stores.
 *
 * ## Lifecycle
 *
 * In normal desktop app lifetime, engines live for the full session and `dispose()` is
 * not called. Call `dispose()` only when replacing an instance or tearing down a
 * short-lived consumer (tests, future embedded previews).
 */
export interface PlaybackEngine {
  /** Instance id from factory options (e.g. `'main'` or `'demo'`). */
  readonly id: string;

  /**
   * Loads media from an abstract source. Does not advance playlist or set track metadata.
   * @param source - Path, URL, or blob URL resolved by the platform adapter.
   */
  load(source: PlaybackSource): Promise<void>;

  /** Starts or resumes playback of the loaded source. */
  play(): Promise<void>;

  /** Pauses playback; position is retained. */
  pause(): void;

  /** Stops playback and resets position to zero. */
  stop(): void;

  /**
   * Seeks to a position in seconds.
   * @param seconds - Target position, clamped by the implementation.
   */
  seek(seconds: number): void;

  /**
   * Sets output volume.
   * @param value - Level in the range 0–1.
   */
  setVolume(value: number): void;

  /**
   * Routes audio to an output device.
   * @param deviceId - Device id or `null` for system default.
   */
  setOutputDevice(deviceId: string | null): Promise<void>;

  /** Returns the current playback snapshot (engine-owned fields only). */
  getSnapshot(): PlaybackSnapshot;

  /**
   * Subscribes to a typed engine event.
   * @returns Disposer; call to unsubscribe.
   */
  subscribe<K extends PlaybackEngineEventName>(
    event: K,
    listener: PlaybackEngineListener<K>,
  ): PlaybackEngineSubscription;

  /**
   * Releases runtime resources and clears all listeners.
   * After dispose, method calls are no-ops or throw per implementation.
   */
  dispose(): void;
}
