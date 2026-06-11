import { createPlaybackEnginePair } from './createPlaybackEngine';
import { DEFAULT_PLAYBACK_VOLUME } from './types';

const pair = createPlaybackEnginePair({
  initialVolume: DEFAULT_PLAYBACK_VOLUME,
});

/** Shared main player engine instance (playerAudioStore). */
export const mainPlaybackEngine = pair.main;

/** Shared demo preview engine instance (demoPlayerStore). */
export const demoPlaybackEngine = pair.demo;
