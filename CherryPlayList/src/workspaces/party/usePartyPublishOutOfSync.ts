import { useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import { useAimpStore, useProjectStore, useSettingsStore } from '@shared/stores';

import { buildPartyPublishSyncParts, resolveHeaderPartyPublishHighlight } from './partyPublishSync';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';

export function usePartyPublishOutOfSync(hasLinkedParty: boolean): boolean {
  const lastSyncedPublishParts = usePartyWorkspaceStore((state) => state.lastSyncedPublishParts);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);
  const metadataSlice = usePartyWorkspaceStore(
    (state) => ({
      partyName: state.partyName,
      partyTitle: state.partyTitle,
      partySubtitle: state.partySubtitle,
      themeId: state.themeId,
      customizationSettings: state.customizationSettings,
      eventDateTime: state.eventDateTime,
      eventEndDateTime: state.eventEndDateTime,
      description: state.description,
      place: state.place,
      city: state.city,
      schedule: state.schedule,
      timeZone: state.timeZone,
      shortDescription: state.shortDescription,
      externalLinkUrl: state.externalLinkUrl,
      externalLinkText: state.externalLinkText,
      danceTags: state.danceTags,
      isListedInCatalog: state.isListedInCatalog,
    }),
    shallow,
  );
  const items = useProjectStore((state) => state.items);
  const partyTrackDisplay = useProjectStore((state) => state.meta.partyTrackDisplay);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpPlaylistSnapshot = useAimpStore((state) => state.bridgeState.playlistSnapshot);

  return useMemo(() => {
    const current = buildPartyPublishSyncParts({
      store: metadataSlice,
      streamingSource,
      aimpPlaylistSnapshot,
      items,
      partyTrackDisplay,
    });
    return resolveHeaderPartyPublishHighlight({
      hasLinkedParty,
      partyLifecycleState,
      lastSynced: lastSyncedPublishParts,
      current,
    });
  }, [
    aimpPlaylistSnapshot,
    hasLinkedParty,
    items,
    lastSyncedPublishParts,
    metadataSlice,
    partyLifecycleState,
    partyTrackDisplay,
    streamingSource,
  ]);
}
