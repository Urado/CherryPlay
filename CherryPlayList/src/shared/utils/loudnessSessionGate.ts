import type { Track } from '@core/types/track';

export const SESSION_GATE_ACTIVE_TRACK_COUNT = 3;

/** First N active tracks in playlist order that must be scanned before session start. */
export function getSessionGateTracks(
  allTracks: Track[],
  isTrackActive: (trackId: string) => boolean,
): Track[] {
  const activeTracks = allTracks.filter((track) => isTrackActive(track.id));
  return activeTracks.slice(0, SESSION_GATE_ACTIVE_TRACK_COUNT);
}

export function areGateTracksReady(tracks: Track[]): boolean {
  return tracks.length === 0 || tracks.every((track) => track.loudness?.status === 'ok');
}

export function getGateTracksNotReady(tracks: Track[]): Track[] {
  return tracks.filter((track) => track.loudness?.status !== 'ok');
}
