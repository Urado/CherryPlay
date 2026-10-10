import type {
  PartyTrackDisplaySettings,
  ProjectGroupSettings,
  ProjectItem,
  ProjectSettings,
  ProjectTrackSettings,
} from '@core/types/project';
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
  trackSettings?: Map<string, ProjectTrackSettings>;
  projectSettings?: ProjectSettings;
  groupSettings?: Map<string, ProjectGroupSettings>;
  getItemPath?: (trackId: string) => string[];
  findItemById?: (id: string) => ProjectItem | null;
  isTrackDisabled?: (trackId: string) => boolean;
}): PlaylistForApiPayload {
  const {
    streamingSource,
    aimpPlaylistSnapshot,
    items,
    partyTrackDisplay,
    trackSettings,
    projectSettings,
    groupSettings,
    getItemPath,
    findItemById,
    isTrackDisabled,
  } = params;
  if (
    resolvePlaylistSource({ streamingSource, aimpPlaylistSnapshot }) === 'aimp' &&
    aimpPlaylistSnapshot
  ) {
    return convertAimpPlaylistForApi(aimpPlaylistSnapshot, partyTrackDisplay);
  }
  return convertPlaylistForApi(items, partyTrackDisplay, {
    trackSettings,
    projectSettings,
    groupSettings,
    getItemPath,
    findItemById,
    isTrackDisabled,
  });
}
