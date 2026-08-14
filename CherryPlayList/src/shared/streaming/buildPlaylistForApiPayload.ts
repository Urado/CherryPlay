import type { PartyTrackDisplaySettings, ProjectItem } from '@core/types/project';
import type { AimpPlaylistSnapshotDto } from '@shared/contracts/aimp';
import { convertAimpPlaylistForApi, convertPlaylistForApi } from '@shared/utils';

import type { PlaylistForApiPayload } from './PlaybackBroadcastSource';

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

export function buildPlaylistForApiPayload(params: {
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
  items: ProjectItem[];
  partyTrackDisplay: PartyTrackDisplaySettings;
}): PlaylistForApiPayload {
  const { streamingSource, aimpPlaylistSnapshot, items, partyTrackDisplay } = params;
  if (
    resolvePlaylistSource({ streamingSource, aimpPlaylistSnapshot }) === 'aimp' &&
    aimpPlaylistSnapshot
  ) {
    return convertAimpPlaylistForApi(aimpPlaylistSnapshot, partyTrackDisplay);
  }
  return convertPlaylistForApi(items, partyTrackDisplay);
}
