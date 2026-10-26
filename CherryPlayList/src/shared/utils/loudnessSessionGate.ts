import type { Track } from '@core/types/track';

export const SESSION_GATE_ACTIVE_TRACK_COUNT = 1;

export const getSessionGateTracks = (
  allTracks: Track[],
  isTrackActive: (trackId: string) => boolean,
): Track[] => {
  const activeTracks = allTracks.filter((track) => isTrackActive(track.id));
  return activeTracks.slice(0, SESSION_GATE_ACTIVE_TRACK_COUNT);
};

export const areGateTracksReady = (tracks: Track[]): boolean => {
  return tracks.length === 0 || tracks.every((track) => track.loudness?.status === 'ok');
};

export const getGateTracksNotReady = (tracks: Track[]): Track[] => {
  return tracks.filter((track) => track.loudness?.status !== 'ok');
};
