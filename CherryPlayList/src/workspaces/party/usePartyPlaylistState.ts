import { type PlaybackState } from '@cherryplay/components';
import { useMemo } from 'react';

import type { PartyTrackDisplaySettings, ProjectItem } from '@core/types/project';
import { normalizeTrackKeyForComparison } from '@shared/contracts/aimp';
import type { AimpPlaylistSnapshotDto } from '@shared/contracts/aimp';
import {
  useAimpStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';
import {
  applyPartyTrackDisplayToComponentPlaylist,
  calculatePartyTotalDuration,
  canUseAimpLiveSnapshots,
  convertAimpPlaylistForApi,
  convertToComponentPlayerItems,
  countTotalTracks,
  createAimpPlaybackStateDto,
} from '@shared/utils';

import { resolvePlaylistSource } from './partyWorkspacePlaylistSource';

function stripPathsFromComponentItems(
  items: ReturnType<typeof convertToComponentPlayerItems>,
): ReturnType<typeof convertToComponentPlayerItems> {
  return items.map((item) => {
    if (item.type === 'track') {
      const { path: _path, ...trackWithoutPath } = item;
      return trackWithoutPath;
    }
    if (item.type === 'group' && item.items) {
      return {
        ...item,
        items: stripPathsFromComponentItems(item.items),
      };
    }
    return item;
  });
}

export function usePartyPlaylistState() {
  const items = useProjectStore((state) => state.items);
  const partyTrackDisplay = useProjectStore((state) => state.meta.partyTrackDisplay);
  const sessionState = useProjectStore((state) => state.sessionState);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);

  const { mode, currentTrackId, playedTrackIds, disabledTrackIds, disabledGroupIds } = useMemo(
    () => ({
      mode: sessionState.mode,
      currentTrackId: sessionState.currentTrackId,
      playedTrackIds: sessionState.playedTrackIds,
      disabledTrackIds: sessionState.disabledTrackIds,
      disabledGroupIds: sessionState.disabledGroupIds,
    }),
    [sessionState],
  );

  const {
    status: audioStatus,
    position: audioPosition,
    duration: audioDuration,
    volume: audioVolume,
  } = usePlayerAudioStore((state) => ({
    status: state.status,
    position: state.position,
    duration: state.duration,
    volume: state.volume,
  }));

  const componentItems = useMemo(
    () => stripPathsFromComponentItems(convertToComponentPlayerItems(items)),
    [items],
  );

  const playlistData = useMemo(() => {
    const playlistSource = resolvePlaylistSource({
      streamingSource,
      aimpPlaylistSnapshot: aimpBridgeState.playlistSnapshot,
    });
    if (playlistSource === 'aimp' && aimpBridgeState.playlistSnapshot) {
      const aimpPlaylist = convertAimpPlaylistForApi(aimpBridgeState.playlistSnapshot);
      return {
        items: aimpPlaylist.items,
        totalDuration: aimpPlaylist.totalDuration,
        totalTracks: aimpPlaylist.totalTracks,
      };
    }
    return {
      items: componentItems,
      totalDuration: calculatePartyTotalDuration(items),
      totalTracks: countTotalTracks(items),
    };
  }, [streamingSource, aimpBridgeState.playlistSnapshot, componentItems, items]);

  const previewPlaylistData = useMemo(
    () => ({
      ...playlistData,
      items: applyPartyTrackDisplayToComponentPlaylist(playlistData.items, partyTrackDisplay),
    }),
    [playlistData, partyTrackDisplay],
  );

  const playbackState = useMemo((): PlaybackState | null => {
    if (
      streamingSource === 'aimp' &&
      aimpBridgeState.liveStreamStarted &&
      canUseAimpLiveSnapshots(aimpBridgeState)
    ) {
      const dto = createAimpPlaybackStateDto(aimpBridgeState) as PlaybackState;
      const resolvedCurrentTrackId =
        dto.currentTrackId && aimpBridgeState.playlistSnapshot
          ? (() => {
              const normalized = normalizeTrackKeyForComparison(dto.currentTrackId!);
              const match = aimpBridgeState.playlistSnapshot!.tracks.find(
                (t) => normalizeTrackKeyForComparison(t.trackKey) === normalized,
              );
              return match ? match.trackKey : dto.currentTrackId;
            })()
          : dto.currentTrackId;
      return { ...dto, currentTrackId: resolvedCurrentTrackId };
    }
    if (mode !== 'session') {
      return null;
    }

    return {
      currentTrackId,
      status: audioStatus,
      position: audioPosition,
      duration: audioDuration,
      volume: audioVolume,
      mode: 'session',
      playedTrackIds,
      disabledTrackIds,
      disabledGroupIds,
      lastUpdatedAt: new Date().toISOString(),
    } as PlaybackState;
  }, [
    streamingSource,
    aimpBridgeState,
    mode,
    currentTrackId,
    audioStatus,
    audioPosition,
    audioDuration,
    audioVolume,
    playedTrackIds,
    disabledTrackIds,
    disabledGroupIds,
  ]);

  return {
    items,
    partyTrackDisplay,
    streamingSource,
    aimpPlaylistSnapshot: aimpBridgeState.playlistSnapshot,
    previewPlaylistData,
    playbackState,
  };
}

export type PartyPlaylistBuildParams = {
  streamingSource: string;
  aimpPlaylistSnapshot: AimpPlaylistSnapshotDto | null;
  items: ProjectItem[];
  partyTrackDisplay: PartyTrackDisplaySettings;
};
