import type { PartyTrackDisplaySettings, ProjectItem } from '@core/types/project';
import type { AimpPlaylistSnapshotDto } from '@shared/contracts/aimp';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { useAimpStore, useProjectStore, useSettingsStore } from '@shared/stores';

import { buildPlaylistForApi } from './partyWorkspaceApiBuilders';
import {
  usePartyWorkspaceStore,
  type PartyPublishSyncParts,
  type PartyWorkspaceState,
} from './partyWorkspaceStore';
import { normalizeCustomizationSettings } from './partyWorkspaceUtils';

export type { PartyPublishSyncParts };

type PartyPublishMetadataSlice = Pick<
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

export function buildPartyPublishMetadataSignature(store: PartyPublishMetadataSlice): string {
  return JSON.stringify({
    partyName: store.partyName,
    partyTitle: store.partyTitle,
    partySubtitle: store.partySubtitle,
    themeId: store.themeId,
    customizationSettings: normalizeCustomizationSettings(store.customizationSettings),
    eventDateTime: store.eventDateTime,
    eventEndDateTime: store.eventEndDateTime,
    description: store.description,
    place: store.place,
    city: store.city,
    schedule: store.schedule,
    timeZone: store.timeZone,
    shortDescription: store.shortDescription,
    externalLinkUrl: store.externalLinkUrl,
    externalLinkText: store.externalLinkText,
    danceTags: store.danceTags,
    isListedInCatalog: store.isListedInCatalog,
  });
}

export function buildPartyPublishPlaylistSignature(params: {
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
  items: ProjectItem[];
  partyTrackDisplay: PartyTrackDisplaySettings;
}): string {
  return JSON.stringify(buildPlaylistForApi(params));
}

export function buildPartyPublishSyncParts(params: {
  store: PartyPublishMetadataSlice;
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
  items: ProjectItem[];
  partyTrackDisplay: PartyTrackDisplaySettings;
}): PartyPublishSyncParts {
  return {
    playlist: buildPartyPublishPlaylistSignature(params),
    metadata: buildPartyPublishMetadataSignature(params.store),
  };
}

export function getCurrentPartyPublishSyncParts(): PartyPublishSyncParts {
  const store = usePartyWorkspaceStore.getState();
  const project = useProjectStore.getState();
  return buildPartyPublishSyncParts({
    store,
    streamingSource: useSettingsStore.getState().streamingSource,
    aimpPlaylistSnapshot: useAimpStore.getState().bridgeState.playlistSnapshot,
    items: project.items,
    partyTrackDisplay: project.meta.partyTrackDisplay,
  });
}

export function resolveHeaderPartyPublishHighlight(input: {
  hasLinkedParty: boolean;
  partyLifecycleState: PartyLifecycleState | null;
  lastSynced: PartyPublishSyncParts | null;
  current: PartyPublishSyncParts;
}): boolean {
  if (!input.hasLinkedParty) {
    return false;
  }
  if (input.partyLifecycleState !== 'ready' && input.partyLifecycleState !== 'draft') {
    return false;
  }
  if (input.lastSynced == null) {
    return false;
  }
  return (
    input.lastSynced.playlist !== input.current.playlist ||
    input.lastSynced.metadata !== input.current.metadata
  );
}

export function markPartyPublishFullySynced(parts?: PartyPublishSyncParts): void {
  usePartyWorkspaceStore
    .getState()
    .setLastSyncedPublishParts(parts ?? getCurrentPartyPublishSyncParts());
}

export function markPartyPublishMetadataSynced(metadataSignature?: string): void {
  const store = usePartyWorkspaceStore.getState();
  const previous = store.lastSyncedPublishParts;
  if (previous == null) {
    markPartyPublishFullySynced();
    return;
  }
  store.setLastSyncedPublishParts({
    playlist: previous.playlist,
    metadata: metadataSignature ?? buildPartyPublishMetadataSignature(store),
  });
}

export function markPartyPublishCatalogVisibilitySynced(listed: boolean): void {
  const store = usePartyWorkspaceStore.getState();
  const previous = store.lastSyncedPublishParts;
  if (previous == null) {
    return;
  }

  let baseline: PartyPublishMetadataSlice;
  try {
    baseline = JSON.parse(previous.metadata) as PartyPublishMetadataSlice;
  } catch {
    return;
  }

  store.setLastSyncedPublishParts({
    playlist: previous.playlist,
    metadata: buildPartyPublishMetadataSignature({
      ...baseline,
      isListedInCatalog: listed,
    }),
  });
}

export function markPartyPublishPlaylistSynced(playlistSignature: string): void {
  const store = usePartyWorkspaceStore.getState();
  const previous = store.lastSyncedPublishParts;
  if (previous == null) {
    const current = getCurrentPartyPublishSyncParts();
    store.setLastSyncedPublishParts({
      playlist: playlistSignature,
      metadata: current.metadata,
    });
    return;
  }
  store.setLastSyncedPublishParts({
    playlist: playlistSignature,
    metadata: previous.metadata,
  });
}

export function clearPartyPublishSync(): void {
  usePartyWorkspaceStore.getState().setLastSyncedPublishParts(null);
}
