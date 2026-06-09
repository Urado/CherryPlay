import type { PlatformAudioAdapter } from './PlatformAudioAdapter';
import type { PlaybackEngine } from './PlaybackEngine';

/**
 * Runtime playback state reported by a {@link PlaybackEngine} instance.
 *
 * Distinct from store/session status: the engine reflects actual media element
 * or native backend state (including loading and buffering).
 */
export type PlaybackEngineStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

/**
 * Abstract media source for {@link PlaybackEngine.load}.
 *
 * Implementations resolve via {@link PlatformAudioAdapter}; stores pass path/URI
 * without coupling to base64 IPC or Capacitor plugins.
 */
export type PlaybackSource =
  | { readonly kind: 'filePath'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'blobUrl'; readonly blobUrl: string };

/**
 * Point-in-time playback truth from the engine (hybrid state model).
 *
 * Stores subscribe to engine events and mirror `status`, `position`, `duration`,
 * `error`, and `outputDeviceId` into UI state. Track metadata, queue, and session
 * flags remain store-owned and are never written by the engine.
 */
export interface PlaybackSnapshot {
  readonly status: PlaybackEngineStatus;
  readonly position: number;
  readonly duration: number;
  readonly volume: number;
  readonly outputDeviceId: string | null;
  readonly error: string | null;
}

/** Well-known instance ids for the two-instance pattern (main + demo). */
export type PlaybackEngineInstanceRole = 'main' | 'demo';

/**
 * Options passed to {@link createPlaybackEngine}.
 *
 * Each call produces a **new** engine instance; there is no shared singleton.
 */
export interface PlaybackEngineOptions {
  /** Unique instance id (e.g. `'main'` or `'demo'` for the two-instance pattern). */
  readonly id: string;
  /** Initial volume in the range 0–1. Defaults to 0.8. */
  readonly initialVolume?: number;
  /** Platform I/O port; defaults to {@link createDefaultPlatformAudioAdapter}. */
  readonly adapter?: PlatformAudioAdapter;
}

/** Pair of independent engines for main player and demo preview. */
export interface PlaybackEnginePair {
  readonly main: PlaybackEngine;
  readonly demo: PlaybackEngine;
}

/** Default volume when `initialVolume` is omitted. */
export const DEFAULT_PLAYBACK_VOLUME = 0.8;

/** Default instance id for the main player engine. */
export const MAIN_PLAYBACK_ENGINE_ID = 'main';

/** Default instance id for the demo preview engine. */
export const DEMO_PLAYBACK_ENGINE_ID = 'demo';
