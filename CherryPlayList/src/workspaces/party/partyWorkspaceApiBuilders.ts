import { convertLocalDateTimeToUtc, getDefaultTimeZone } from '@cherryplay/components';

import type { PartyTrackDisplaySettings, ProjectItem } from '@core/types/project';
import type { AimpPlaylistSnapshotDto } from '@shared/contracts/aimp';
import { CreatePartyDto } from '@shared/services/partyService';
import { convertAimpPlaylistForApi, convertPlaylistForApi } from '@shared/utils';

import type { PartyWorkspaceState } from './partyWorkspaceStore';
import { normalizeCustomizationSettings } from './partyWorkspaceUtils';

type PartyMetadataStoreSlice = Pick<
  PartyWorkspaceState,
  | 'partyName'
  | 'partyTitle'
  | 'partySubtitle'
  | 'themeId'
  | 'customizationSettings'
  | 'eventDateTime'
  | 'eventEndDateTime'
  | 'description'
  | 'place'
  | 'city'
  | 'schedule'
  | 'timeZone'
  | 'shortDescription'
  | 'externalLinkUrl'
  | 'externalLinkText'
  | 'danceTags'
>;

export function buildPlaylistForApi(params: {
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
  items: ProjectItem[];
  partyTrackDisplay: PartyTrackDisplaySettings;
}) {
  const { streamingSource, aimpPlaylistSnapshot, items, partyTrackDisplay } = params;
  if (streamingSource === 'aimp' && aimpPlaylistSnapshot) {
    return convertAimpPlaylistForApi(aimpPlaylistSnapshot, partyTrackDisplay);
  }
  return convertPlaylistForApi(items, partyTrackDisplay);
}

export function buildCreatePartyDto(
  store: PartyMetadataStoreSlice,
  playlistForApi: ReturnType<typeof convertPlaylistForApi>,
  options?: { partyName?: string },
): CreatePartyDto {
  const tz = store.timeZone.trim() || getDefaultTimeZone();
  const name = options?.partyName ?? store.partyName;

  return {
    name,
    title: store.partyTitle.trim() || undefined,
    subtitle: store.partySubtitle.trim() || undefined,
    partyThemeId: store.themeId,
    customizationSettings: normalizeCustomizationSettings(store.customizationSettings),
    playlistData: playlistForApi,
    eventDateTime: store.eventDateTime
      ? convertLocalDateTimeToUtc(store.eventDateTime, tz)
      : undefined,
    eventEndDateTime: store.eventEndDateTime
      ? convertLocalDateTimeToUtc(store.eventEndDateTime, tz)
      : undefined,
    description: store.description.trim() || undefined,
    place: store.place.trim() || undefined,
    city: store.city.trim() || undefined,
    schedule: store.schedule.trim() || undefined,
    timeZone: store.timeZone.trim() || undefined,
    isListedInCatalog: true,
    shortDescription: store.shortDescription.trim() || undefined,
    externalLinkUrl: store.externalLinkUrl.trim() || undefined,
    externalLinkText: store.externalLinkText.trim() || undefined,
    danceTags: store.danceTags.length > 0 ? store.danceTags : undefined,
  };
}
