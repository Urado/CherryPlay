import type { PartyPlaylistData, PlaybackState } from '../../types';
import { getFlatTracksInDisplayOrder } from '../utils/playlist';

export function isProgramEnded(
  playlist: PartyPlaylistData,
  playbackState: PlaybackState | null | undefined,
): boolean {
  if (!playbackState || playbackState.mode !== 'session') {
    return false;
  }

  if (playbackState.playedTrackIds.length === 0) {
    return false;
  }

  const flatTracks = getFlatTracksInDisplayOrder(playlist.items);
  const { disabledTrackIds, playedTrackIds, currentTrackId, status } = playbackState;

  const notYetPlayedCount = flatTracks.filter(
    (t) =>
      !disabledTrackIds.includes(t.id) && t.id !== currentTrackId && !playedTrackIds.includes(t.id),
  ).length;

  if (notYetPlayedCount > 0) {
    return false;
  }

  if (!currentTrackId) {
    return true;
  }

  return status === 'ended';
}
