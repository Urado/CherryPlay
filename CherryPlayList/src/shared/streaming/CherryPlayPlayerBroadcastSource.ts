import { mapStoreStatusToWireStatus, type PlaybackStateDto } from '../contracts/playbackState';
import { useAimpStore } from '../stores/aimpStore';
import { usePlayerAudioStore } from '../stores/playerAudioStore';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';

import { buildPlaylistForApiPayload } from './buildPlaylistForApiPayload';
import type { PlaybackBroadcastSource, PlaylistForApiPayload } from './PlaybackBroadcastSource';

export class CherryPlayPlayerBroadcastSource implements PlaybackBroadcastSource {
  readonly sourceId = 'cherryPlayPlayer' as const;

  subscribe(callback: () => void): () => void {
    const audioState = usePlayerAudioStore.getState();
    let lastTrackId = audioState.currentTrack?.id ?? null;
    let lastWireStatus = mapStoreStatusToWireStatus(audioState.status);

    const projectState = useProjectStore.getState();
    let lastDisabledTrackIds = [...projectState.sessionState.disabledTrackIds].sort().join(',');
    let lastDisabledGroupIds = [...projectState.sessionState.disabledGroupIds].sort().join(',');

    const unsubscribeAudio = usePlayerAudioStore.subscribe((state) => {
      const trackId = state.currentTrack?.id ?? null;
      const wireStatus = mapStoreStatusToWireStatus(state.status);

      if (trackId !== lastTrackId || wireStatus !== lastWireStatus) {
        lastTrackId = trackId;
        lastWireStatus = wireStatus;
        callback();
      }
    });

    const unsubscribeSession = useProjectStore.subscribe((state) => {
      const disabledTrackIdsKey = [...state.sessionState.disabledTrackIds].sort().join(',');
      const disabledGroupIdsKey = [...state.sessionState.disabledGroupIds].sort().join(',');

      if (
        disabledTrackIdsKey !== lastDisabledTrackIds ||
        disabledGroupIdsKey !== lastDisabledGroupIds
      ) {
        lastDisabledTrackIds = disabledTrackIdsKey;
        lastDisabledGroupIds = disabledGroupIdsKey;
        callback();
      }
    });

    let isInitialItemsCall = true;
    const unsubscribeItems = useProjectStore.subscribe(() => {
      if (isInitialItemsCall) {
        isInitialItemsCall = false;
        return;
      }
      callback();
    });

    return () => {
      unsubscribeAudio();
      unsubscribeSession();
      unsubscribeItems();
    };
  }

  getPlaybackStateDto(): PlaybackStateDto {
    const audioState = usePlayerAudioStore.getState();
    const projectState = useProjectStore.getState();

    return {
      currentTrackId: audioState.currentTrack?.id ?? null,
      status: mapStoreStatusToWireStatus(audioState.status),
      position: audioState.position,
      duration: audioState.duration,
      volume: audioState.volume,
      mode: projectState.sessionState.mode,
      playedTrackIds: [...projectState.sessionState.playedTrackIds],
      disabledTrackIds: [...projectState.sessionState.disabledTrackIds],
      disabledGroupIds: [...projectState.sessionState.disabledGroupIds],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  getCurrentTrackId(): string | null {
    return usePlayerAudioStore.getState().currentTrack?.id ?? null;
  }

  getPosition(): number {
    return usePlayerAudioStore.getState().position;
  }

  getPlaylistForApi(): PlaylistForApiPayload {
    const projectState = useProjectStore.getState();
    return buildPlaylistForApiPayload({
      streamingSource: useSettingsStore.getState().streamingSource,
      aimpPlaylistSnapshot: useAimpStore.getState().bridgeState.playlistSnapshot,
      items: projectState.items,
      partyTrackDisplay: projectState.meta.partyTrackDisplay,
    });
  }

  isLiveSessionActive(): boolean {
    return useProjectStore.getState().sessionState.mode === 'session';
  }

  shouldSendPositionTicks(): boolean {
    return this.isLiveSessionActive();
  }
}
