import type { PlaybackStateDto } from '../contracts/playbackState';
import { useAimpStore } from '../stores/aimpStore';
import { useProjectStore } from '../stores/projectStore';
import {
  canAdvanceAimpPlayback,
  canStartAimpLiveStream,
  convertAimpPlaylistForApi,
  createAimpPlaybackStateDto,
  getAimpEffectiveProgressMs,
  getAimpPlaybackPublishKey,
} from '../utils/aimpStreamingAdapter';

import type { PlaybackBroadcastSource, PlaylistForApiPayload } from './PlaybackBroadcastSource';

export interface AimpFrozenStateSnapshot {
  key: string;
  dto: PlaybackStateDto;
}

export class AimpBroadcastSource implements PlaybackBroadcastSource {
  readonly sourceId = 'aimp' as const;

  subscribe(callback: () => void): () => void {
    let lastPlaybackPublishKey = getAimpPlaybackPublishKey(useAimpStore.getState().bridgeState);

    return useAimpStore.subscribe((state) => {
      const bridgeState = state.bridgeState;
      if (!bridgeState.liveStreamStarted) {
        lastPlaybackPublishKey = getAimpPlaybackPublishKey(bridgeState);
        return;
      }

      const playbackPublishKey = getAimpPlaybackPublishKey(bridgeState);
      if (playbackPublishKey === lastPlaybackPublishKey) {
        return;
      }

      lastPlaybackPublishKey = playbackPublishKey;
      callback();
    });
  }

  getPlaybackStateDto(): PlaybackStateDto {
    const bridgeState = useAimpStore.getState().bridgeState;
    return createAimpPlaybackStateDto(bridgeState);
  }

  getCurrentTrackId(): string | null {
    const bridgeState = useAimpStore.getState().bridgeState;
    return (
      bridgeState.playbackSnapshot?.currentTrackKey ??
      bridgeState.playlistSnapshot?.activeTrackKey ??
      null
    );
  }

  getPosition(): number {
    const bridgeState = useAimpStore.getState().bridgeState;
    return getAimpEffectiveProgressMs(bridgeState) / 1000;
  }

  getPlaylistForApi(): PlaylistForApiPayload {
    const bridgeState = useAimpStore.getState().bridgeState;
    const partyTrackDisplay = useProjectStore.getState().meta.partyTrackDisplay;
    return convertAimpPlaylistForApi(bridgeState.playlistSnapshot, partyTrackDisplay);
  }

  isLiveSessionActive(): boolean {
    const { bridgeState, publishingBridgeReady } = useAimpStore.getState();
    return (
      bridgeState.liveStreamStarted && publishingBridgeReady && canStartAimpLiveStream(bridgeState)
    );
  }

  shouldSendPositionTicks(): boolean {
    const bridgeState = useAimpStore.getState().bridgeState;
    return (
      this.isLiveSessionActive() &&
      canAdvanceAimpPlayback(bridgeState.connection.phase, bridgeState.playbackSnapshot?.status)
    );
  }

  /**
   * Snapshot for viewers when AIMP live stream started but live publish gates are not met yet.
   */
  getFrozenStateSnapshot(enableStreaming: boolean): AimpFrozenStateSnapshot | null {
    const { bridgeState, publishingBridgeReady } = useAimpStore.getState();

    if (!bridgeState.liveStreamStarted || !publishingBridgeReady) {
      return null;
    }

    if (enableStreaming && canStartAimpLiveStream(bridgeState)) {
      return null;
    }

    if (bridgeState.playlistSnapshot === null || bridgeState.playbackSnapshot === null) {
      return null;
    }

    return {
      key: `${bridgeState.playlistSnapshot.revision}:${bridgeState.playbackSnapshot.receivedAt}`,
      dto: createAimpPlaybackStateDto(
        bridgeState,
        Date.parse(bridgeState.playbackSnapshot.receivedAt),
      ),
    };
  }
}
