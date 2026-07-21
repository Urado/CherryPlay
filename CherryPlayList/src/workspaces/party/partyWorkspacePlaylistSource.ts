import type { AimpPlaylistSnapshotDto } from '@shared/contracts/aimp';

export type PartyPlaylistSource = 'aimp' | 'project';

export function resolvePlaylistSource(params: {
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
}): PartyPlaylistSource {
  if (
    params.streamingSource === 'aimp' &&
    params.aimpPlaylistSnapshot != null &&
    params.aimpPlaylistSnapshot.tracks.length > 0
  ) {
    return 'aimp';
  }
  return 'project';
}
