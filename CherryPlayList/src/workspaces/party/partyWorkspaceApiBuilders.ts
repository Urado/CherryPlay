import { convertLocalDateTimeToUtc, getDefaultTimeZone } from '@cherryplay/components';

import type { PartyTrackDisplaySettings, ProjectItem } from '@core/types/project';
import type { AimpPlaylistSnapshotDto } from '@shared/contracts/aimp';
import { CreatePartyDto, type UpdatePartyDto } from '@shared/services/partyService';
import { convertAimpPlaylistForApi, convertPlaylistForApi } from '@shared/utils';

import { resolvePlaylistSource } from './partyWorkspacePlaylistSource';
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
  | 'isListedInCatalog'
>;

type PartyUpdateMetadataStoreSlice = PartyMetadataStoreSlice &
  Pick<PartyWorkspaceState, 'eventEndDateTimeTouched' | 'hasInitialEventEndDateTime'>;

function resolvePartyTimeZone(store: Pick<PartyWorkspaceState, 'timeZone'>): string {
  return store.timeZone.trim() || getDefaultTimeZone();
}

function buildSharedPartyMetadataFields(store: PartyMetadataStoreSlice, tz: string) {
  return {
    title: store.partyTitle.trim() || undefined,
    subtitle: store.partySubtitle.trim() || undefined,
    partyThemeId: store.themeId,
    customizationSettings: normalizeCustomizationSettings(store.customizationSettings),
    eventDateTime: store.eventDateTime
      ? convertLocalDateTimeToUtc(store.eventDateTime, tz)
      : undefined,
    description: store.description.trim() || undefined,
    place: store.place.trim() || undefined,
    city: store.city.trim() || undefined,
    schedule: store.schedule.trim() || undefined,
    timeZone: store.timeZone.trim() || undefined,
  };
}

function resolveEventEndDateTimeForUpdate(
  store: PartyUpdateMetadataStoreSlice,
  tz: string,
): string | null | undefined {
  if (!store.eventEndDateTimeTouched) {
    return undefined;
  }
  if (!store.eventEndDateTime.trim()) {
    return store.hasInitialEventEndDateTime ? null : undefined;
  }
  return convertLocalDateTimeToUtc(store.eventEndDateTime, tz);
}

export function buildPlaylistForApi(params: {
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
  items: ProjectItem[];
  partyTrackDisplay: PartyTrackDisplaySettings;
}) {
  const { streamingSource, aimpPlaylistSnapshot, items, partyTrackDisplay } = params;
  if (
    resolvePlaylistSource({ streamingSource, aimpPlaylistSnapshot }) === 'aimp' &&
    aimpPlaylistSnapshot
  ) {
    return convertAimpPlaylistForApi(aimpPlaylistSnapshot, partyTrackDisplay);
  }
  return convertPlaylistForApi(items, partyTrackDisplay);
}

export function buildCreatePartyDto(
  store: PartyMetadataStoreSlice,
  playlistForApi: ReturnType<typeof convertPlaylistForApi>,
  options?: { partyName?: string },
): CreatePartyDto {
  const tz = resolvePartyTimeZone(store);
  const name = options?.partyName ?? store.partyName;

  return {
    name,
    ...buildSharedPartyMetadataFields(store, tz),
    playlistData: playlistForApi,
    eventEndDateTime: store.eventEndDateTime
      ? convertLocalDateTimeToUtc(store.eventEndDateTime, tz)
      : undefined,
    isListedInCatalog: store.isListedInCatalog,
    shortDescription: store.shortDescription.trim() || undefined,
    externalLinkUrl: store.externalLinkUrl.trim() || undefined,
    externalLinkText: store.externalLinkText.trim() || undefined,
    danceTags: store.danceTags.length > 0 ? store.danceTags : undefined,
  };
}

export function buildUpdatePartyDto(store: PartyUpdateMetadataStoreSlice): UpdatePartyDto {
  const tz = resolvePartyTimeZone(store);

  return {
    name: store.partyName,
    ...buildSharedPartyMetadataFields(store, tz),
    eventEndDateTime: resolveEventEndDateTimeForUpdate(store, tz),
    shortDescription: store.shortDescription.trim(),
    externalLinkUrl: store.externalLinkUrl.trim(),
    externalLinkText: store.externalLinkText.trim(),
    danceTags: store.danceTags,
    isListedInCatalog: store.isListedInCatalog,
  };
}
