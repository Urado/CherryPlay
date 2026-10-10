import { mapStoreStatusToWireStatus, type PlaybackStateDto } from '../contracts/playbackState';
import { useAimpStore } from '../stores/aimpStore';
import { usePlayerAudioStore } from '../stores/playerAudioStore';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  collectProgramTracksInOrder,
  resolveGuestSitePlaybackPresentation,
} from '../utils/programTrackUtils';

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
    let lastTrackSettingsKey = [...projectState.trackSettings.entries()]
      .map(([id, settings]) => `${id}:${settings.hiddenFromSite === true ? '1' : '0'}`)
      .sort()
      .join(',');

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
      const trackSettingsKey = [...state.trackSettings.entries()]
        .map(([id, settings]) => `${id}:${settings.hiddenFromSite === true ? '1' : '0'}`)
        .sort()
        .join(',');

      if (
        disabledTrackIdsKey !== lastDisabledTrackIds ||
        disabledGroupIdsKey !== lastDisabledGroupIds ||
        trackSettingsKey !== lastTrackSettingsKey
      ) {
        lastDisabledTrackIds = disabledTrackIdsKey;
        lastDisabledGroupIds = disabledGroupIdsKey;
        lastTrackSettingsKey = trackSettingsKey;
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
    const orderedTracks = collectProgramTracksInOrder(projectState.items);
    const wireStatus = mapStoreStatusToWireStatus(audioState.status);
    const presentation = resolveGuestSitePlaybackPresentation({
      currentTrackId: audioState.currentTrack?.id ?? null,
      status: wireStatus,
      position: audioState.position,
      duration: audioState.duration,
      orderedTracks,
      trackSettings: projectState.trackSettings,
    });

    return {
      currentTrackId: presentation.currentTrackId,
      status: presentation.status,
      position: presentation.position,
      duration: presentation.duration,
      volume: audioState.volume,
      mode: projectState.sessionState.mode,
      playedTrackIds: [...projectState.sessionState.playedTrackIds],
      disabledTrackIds: [...projectState.sessionState.disabledTrackIds],
      disabledGroupIds: [...projectState.sessionState.disabledGroupIds],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  getCurrentTrackId(): string | null {
    return this.getPlaybackStateDto().currentTrackId;
  }

  getPosition(): number {
    return this.getPlaybackStateDto().position;
  }

  getPlaylistForApi(): PlaylistForApiPayload {
    const projectState = useProjectStore.getState();
    const disabledTrackIds = new Set(projectState.sessionState.disabledTrackIds);
    const disabledGroupIds = new Set(projectState.sessionState.disabledGroupIds);

    return buildPlaylistForApiPayload({
      streamingSource: useSettingsStore.getState().streamingSource,
      aimpPlaylistSnapshot: useAimpStore.getState().bridgeState.playlistSnapshot,
      items: projectState.items,
      partyTrackDisplay: projectState.meta.partyTrackDisplay,
      trackSettings: projectState.trackSettings,
      projectSettings: projectState.settings,
      groupSettings: projectState.groupSettings,
      getItemPath: projectState.getItemPath,
      findItemById: projectState.findItemById,
      isTrackDisabled: (trackId) => {
        if (disabledTrackIds.has(trackId)) {
          return true;
        }
        const path = projectState.getItemPath(trackId);
        return path.some((segmentId) => disabledGroupIds.has(segmentId));
      },
    });
  }

  isLiveSessionActive(): boolean {
    return useProjectStore.getState().sessionState.mode === 'session';
  }

  shouldSendPositionTicks(): boolean {
    return this.isLiveSessionActive();
  }
}
