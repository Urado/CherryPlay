/**
 * Site Streamer → Party metadata REST boundary (live playlist sync only).
 *
 * During an active broadcast session, playlist changes trigger PUT via
 * `partyService.updatePartyPlaylist`. Started/stopped by
 * `StreamingOrchestrator.startSourceSubscriptions` / `stopSourceSubscriptions`.
 *
 * Party metadata owns initial publish, explicit Publish, create/update lifecycle,
 * and bind-party flows (`usePartyServerActions`, `LinkPartyModal`) — not this module.
 *
 * Subscribes to `useProjectStore` (CherryPlay Player) or `useAimpStore` (AIMP) so the
 * Streamer can mirror viewer-facing queue changes; orchestrator-owned, not Player UI effects.
 */

import { partyService } from '../services/partyService';
import { useAimpStore } from '../stores/aimpStore';
import { useProjectStore } from '../stores/projectStore';
import { getAimpPlaylistPublishKey } from '../utils/aimpStreamingAdapter';

import type { PlaylistForApiPayload } from './PlaybackBroadcastSource';

/**
 * Sends playlist payload to Party REST API (PUT) for live session sync.
 */
export async function syncPartyPlaylist(
  partyId: string,
  payload: PlaylistForApiPayload,
): Promise<void> {
  console.log('[PartyPlaylistSync] → Sending PUT request to update playlist:', {
    partyId,
    itemsCount: payload.items.length,
    timestamp: new Date().toISOString(),
  });

  await partyService.updatePartyPlaylist(partyId, payload);

  console.log('[PartyPlaylistSync] ✓ Playlist updated successfully');
}

/**
 * Subscribes to project store item changes and syncs playlist to the server.
 * Skips the initial subscription fire (same as legacy signalRService behavior).
 */
export function subscribePartyPlaylistSync(
  partyId: string,
  getPayload: () => PlaylistForApiPayload,
  onAfterSync: () => void,
): () => void {
  let isInitialCall = true;

  return useProjectStore.subscribe(() => {
    if (isInitialCall) {
      isInitialCall = false;
      return;
    }

    const projectState = useProjectStore.getState();
    console.log('[PartyPlaylistSync] Playlist changed:', {
      itemsCount: projectState.items.length,
      timestamp: new Date().toISOString(),
    });

    const payload = getPayload();
    void syncPartyPlaylist(partyId, payload).catch((error) => {
      console.error('[PartyPlaylistSync] ✗ Failed to update playlist:', error);
    });
    onAfterSync();
  });
}

/**
 * Subscribes to AIMP playlist snapshot revisions and syncs playlist to the server.
 * Uses `getAimpPlaylistPublishKey` so PUT runs only when revision changes.
 */
export function subscribeAimpPartyPlaylistSync(
  partyId: string,
  getPayload: () => PlaylistForApiPayload,
  onAfterSync: () => void,
  onSyncError?: (error: unknown) => void,
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
    syncPartyPlaylist(partyId, payload)
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
