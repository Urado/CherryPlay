import { partyService } from '../services/partyService';
import { useAimpStore } from '../stores/aimpStore';
import { useProjectStore } from '../stores/projectStore';
import { getAimpPlaylistPublishKey } from '../utils/aimpStreamingAdapter';

import type { PlaylistForApiPayload } from './PlaybackBroadcastSource';

export async function syncPartyPlaylist(
  partyId: string,
  payload: PlaylistForApiPayload,
  onSynced?: (payload: PlaylistForApiPayload) => void,
): Promise<void> {
  console.log('[PartyPlaylistSync] → Sending PUT request to update playlist:', {
    partyId,
    itemsCount: payload.items.length,
    timestamp: new Date().toISOString(),
  });

  await partyService.updatePartyPlaylist(partyId, payload);
  onSynced?.(payload);

  console.log('[PartyPlaylistSync] ✓ Playlist updated successfully');
}

export function subscribePartyPlaylistSync(
  partyId: string,
  getPayload: () => PlaylistForApiPayload,
  onAfterSync: () => void,
  onSyncError?: (error: unknown) => void,
  onSynced?: (payload: PlaylistForApiPayload) => void,
): () => void {
  let isInitialCall = true;
  let isSyncing = false;
  let latestPayload: PlaylistForApiPayload | null = null;

  const syncLatestPayload = async (): Promise<void> => {
    if (isSyncing || !latestPayload) {
      return;
    }

    isSyncing = true;
    try {
      while (latestPayload) {
        const payload = latestPayload;
        latestPayload = null;
        try {
          await syncPartyPlaylist(partyId, payload, onSynced);
          onAfterSync();
        } catch (error) {
          console.error('[PartyPlaylistSync] ✗ Failed to update playlist:', error);
          onSyncError?.(error);
        }
      }
    } finally {
      isSyncing = false;
      if (latestPayload) {
        void syncLatestPayload();
      }
    }
  };

  return useProjectStore.subscribe(() => {
    if (isInitialCall) {
      isInitialCall = false;
      return;
    }

    const projectState = useProjectStore.getState();
    if (
      Object.prototype.hasOwnProperty.call(projectState, 'meta') &&
      projectState.meta.linkedParty?.id !== partyId
    ) {
      return;
    }

    console.log('[PartyPlaylistSync] Playlist changed:', {
      itemsCount: projectState.items.length,
      timestamp: new Date().toISOString(),
    });

    latestPayload = getPayload();
    void syncLatestPayload();
  });
}

export function subscribeAimpPartyPlaylistSync(
  partyId: string,
  getPayload: () => PlaylistForApiPayload,
  onAfterSync: () => void,
  onSyncError?: (error: unknown) => void,
  onSynced?: (payload: PlaylistForApiPayload) => void,
): () => void {
  let lastPublishedKey: string | null = null;

  return useAimpStore.subscribe(() => {
    const bridgeState = useAimpStore.getState().bridgeState;
    if (!bridgeState.liveStreamStarted) {
      lastPublishedKey = null;
      return;
    }

    const publishKey = getAimpPlaylistPublishKey(bridgeState.playlistSnapshot);
    if (publishKey === null || publishKey === lastPublishedKey) {
      return;
    }

    const payload = getPayload();
    syncPartyPlaylist(partyId, payload, onSynced)
      .then(() => {
        lastPublishedKey = publishKey;
        onAfterSync();
      })
      .catch((error) => {
        console.error('[PartyPlaylistSync] ✗ Failed to update AIMP playlist:', error);
        onSyncError?.(error);
      });
  });
}
