import { createDefaultPlatformAudioAdapter } from './createDefaultPlatformAudioAdapter';
import type { PlaybackEngine } from './PlaybackEngine';
import type { PlaybackEngineOptions, PlaybackEnginePair } from './types';
import { DEFAULT_PLAYBACK_VOLUME, DEMO_PLAYBACK_ENGINE_ID, MAIN_PLAYBACK_ENGINE_ID } from './types';
import { WebAudioPlaybackEngine } from './WebAudioPlaybackEngine';

/**
 * Creates a **new** {@link PlaybackEngine} instance. Each call is independent.
 *
 * The desktop app imports shared main/demo instances from `playbackEngines.ts` instead
 * of calling this factory per store. Use this for tests or custom one-off engines.
 *
 * @param options - Instance id, volume, and optional adapter.
 */
export function createPlaybackEngine(options: PlaybackEngineOptions): PlaybackEngine {
  const adapter = options.adapter ?? createDefaultPlatformAudioAdapter();

  return new WebAudioPlaybackEngine({
    id: options.id,
    initialVolume: options.initialVolume ?? DEFAULT_PLAYBACK_VOLUME,
    adapter,
  });
}

/**
 * Creates the standard **main + demo** engine pair with distinct instance ids.
 *
 * Follows the two-instance pattern: independent engines for `playerAudioStore` and
 * `demoPlayerStore` after migration. Device conflict policy remains in stores.
 *
 * @param overrides - Optional shared options (adapter, volume); ids are fixed to main/demo.
 */
export function createPlaybackEnginePair(
  overrides: Omit<PlaybackEngineOptions, 'id'> = {},
): PlaybackEnginePair {
  const shared: Omit<PlaybackEngineOptions, 'id'> = {
    initialVolume: overrides.initialVolume ?? DEFAULT_PLAYBACK_VOLUME,
    adapter: overrides.adapter,
  };

  return {
    main: createPlaybackEngine({ ...shared, id: MAIN_PLAYBACK_ENGINE_ID }),
    demo: createPlaybackEngine({ ...shared, id: DEMO_PLAYBACK_ENGINE_ID }),
  };
}
