import type { AimpBridgeState } from '@shared/contracts/aimp';
import {
  getAimpCurrentTrack,
  getAimpEffectiveProgressMs,
} from '@shared/utils/aimpStreamingAdapter';

const NEAR_END_TOLERANCE_MS = 2000;

export function detectAimpLiveProgramEnded(
  state: Pick<
    AimpBridgeState,
    'liveStreamStarted' | 'playlistSnapshot' | 'playbackSnapshot' | 'connection'
  >,
  nowMs: number = Date.now(),
): boolean {
  if (!state.liveStreamStarted) {
    return false;
  }

  const playback = state.playbackSnapshot;
  const playlist = state.playlistSnapshot;
  if (!playback || !playlist || playlist.tracks.length === 0) {
    return false;
  }

  if (playback.status !== 'stopped') {
    return false;
  }

  const currentTrack = getAimpCurrentTrack(state);
  if (!currentTrack) {
    return false;
  }

  const maxOrder = playlist.tracks.reduce((max, track) => Math.max(max, track.order), 0);
  if (currentTrack.order < maxOrder) {
    return false;
  }

  const durationMs = playback.durationMs ?? currentTrack.durationMs;
  if (typeof durationMs !== 'number' || durationMs <= 0) {
    return false;
  }

  const progressMs = getAimpEffectiveProgressMs(state, nowMs);
  if (progressMs <= 0) {
    return false;
  }

  return progressMs >= durationMs - NEAR_END_TOLERANCE_MS;
}
