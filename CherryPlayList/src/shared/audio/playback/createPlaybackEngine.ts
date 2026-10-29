import { createDefaultPlatformAudioAdapter } from './createDefaultPlatformAudioAdapter';
import type { PlaybackEngine } from './PlaybackEngine';
import type { PlaybackEngineOptions, PlaybackEnginePair } from './types';
import { DEFAULT_PLAYBACK_VOLUME, DEMO_PLAYBACK_ENGINE_ID, MAIN_PLAYBACK_ENGINE_ID } from './types';
import { WebAudioPlaybackEngine } from './WebAudioPlaybackEngine';

export const createPlaybackEngine = (options: PlaybackEngineOptions): PlaybackEngine => {
  const adapter = options.adapter ?? createDefaultPlatformAudioAdapter();

  return new WebAudioPlaybackEngine({
    id: options.id,
    initialVolume: options.initialVolume ?? DEFAULT_PLAYBACK_VOLUME,
    adapter,
  });
};

export const createPlaybackEnginePair = (
  overrides: Omit<PlaybackEngineOptions, 'id'> = {},
): PlaybackEnginePair => {
  const shared: Omit<PlaybackEngineOptions, 'id'> = {
    initialVolume: overrides.initialVolume ?? DEFAULT_PLAYBACK_VOLUME,
    adapter: overrides.adapter,
  };

  return {
    main: createPlaybackEngine({ ...shared, id: MAIN_PLAYBACK_ENGINE_ID }),
    demo: createPlaybackEngine({ ...shared, id: DEMO_PLAYBACK_ENGINE_ID }),
  };
};
