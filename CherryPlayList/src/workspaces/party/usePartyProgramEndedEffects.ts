import { isProjectTrack, type ProjectItem } from '@core/types/project';
import {
  useAimpStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';
import { useEffect, useMemo, useRef } from 'react';

import {
  getPartyPlaybackSourceAdapter,
  resolvePartyPlaybackSourceState,
} from './partyPlaybackSource';
import {
  clearPartyProgramEnded,
  markPartyProgramEnded,
  usePartyProgramEndedStore,
} from './partyProgramEndedStore';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';

const collectActiveTrackIds = (
  items: ReadonlyArray<ProjectItem>,
  disabledTrackIds: ReadonlyArray<string>,
): string[] => {
  const disabled = new Set(disabledTrackIds);
  return items
    .filter((item) => isProjectTrack(item) && !disabled.has(item.id))
    .map((item) => item.id);
};

const isReadyLivePartyContext = (sessionActive: boolean): boolean => {
  const project = useProjectStore.getState();
  if (!sessionActive || !project.meta.linkedParty) {
    return false;
  }
  return usePartyWorkspaceStore.getState().partyLifecycleState === 'ready';
};

export const usePartyProgramEndedEffects = (): void => {
  const programEnded = usePartyProgramEndedStore((state) => state.programEnded);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const linkedParty = useProjectStore((state) => state.meta.linkedParty);
  const items = useProjectStore((state) => state.items);
  const disabledTrackIds = useProjectStore((state) => state.sessionState.disabledTrackIds);
  const playbackStatus = usePlayerAudioStore((state) => state.status);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);

  const playlistSignature = `${items.map((item) => item.id).join('|')}#${disabledTrackIds.join(',')}`;
  const playbackSourceContext = useMemo(
    () => ({
      sessionMode,
      playerPlaybackStatus: playbackStatus,
      aimpBridgeState,
    }),
    [sessionMode, playbackStatus, aimpBridgeState],
  );
  const playbackSourceAdapter = getPartyPlaybackSourceAdapter(streamingSource);
  const playbackSourceState = resolvePartyPlaybackSourceState(
    streamingSource,
    playbackSourceContext,
  );
  const snapshotPlayback = playbackSourceAdapter.completionDetection === 'playback-snapshot';

  const prevPlaylistSignatureRef = useRef(playlistSignature);
  const prevSnapshotTrackCountRef = useRef(playbackSourceState.playlistTrackCount);
  const sawSnapshotPlayingRef = useRef(false);

  useEffect(() => {
    if (!playbackSourceState.sessionActive) {
      clearPartyProgramEnded();
    }
  }, [playbackSourceState.sessionActive]);

  useEffect(() => {
    if (partyLifecycleState === 'completed' || !linkedParty) {
      clearPartyProgramEnded();
    }
  }, [partyLifecycleState, linkedParty]);

  useEffect(() => {
    if (!programEnded) {
      return;
    }
    if (playbackSourceState.playbackStatus === 'playing') {
      clearPartyProgramEnded();
    }
  }, [programEnded, playbackSourceState.playbackStatus]);

  useEffect(() => {
    if (!programEnded) {
      prevPlaylistSignatureRef.current = playlistSignature;
      return;
    }
    if (prevPlaylistSignatureRef.current === playlistSignature) {
      return;
    }
    prevPlaylistSignatureRef.current = playlistSignature;

    const played = new Set(useProjectStore.getState().sessionState.playedTrackIds);
    const activeIds = collectActiveTrackIds(items, disabledTrackIds);
    const hasContinuingTracks = activeIds.some((id) => !played.has(id));
    if (hasContinuingTracks) {
      clearPartyProgramEnded();
    }
  }, [programEnded, playlistSignature, items, disabledTrackIds]);

  useEffect(() => {
    if (!programEnded) {
      prevSnapshotTrackCountRef.current = playbackSourceState.playlistTrackCount;
      return;
    }
    if (!snapshotPlayback) {
      return;
    }
    if (playbackSourceState.playlistTrackCount > prevSnapshotTrackCountRef.current) {
      clearPartyProgramEnded();
    }
    prevSnapshotTrackCountRef.current = playbackSourceState.playlistTrackCount;
  }, [programEnded, snapshotPlayback, playbackSourceState.playlistTrackCount]);

  useEffect(() => {
    if (!snapshotPlayback || !playbackSourceState.sessionActive) {
      sawSnapshotPlayingRef.current = false;
      return;
    }
    if (playbackSourceState.playbackStatus === 'playing') {
      sawSnapshotPlayingRef.current = true;
      return;
    }
    if (
      !sawSnapshotPlayingRef.current ||
      programEnded ||
      !isReadyLivePartyContext(playbackSourceState.sessionActive)
    ) {
      return;
    }
    if (playbackSourceAdapter.detectProgramEnded(playbackSourceContext)) {
      markPartyProgramEnded();
    }
  }, [
    snapshotPlayback,
    playbackSourceState.sessionActive,
    playbackSourceState.playbackStatus,
    programEnded,
    linkedParty,
    partyLifecycleState,
    sessionMode,
    playbackSourceState.playlistRevision,
    playbackSourceAdapter,
    playbackSourceContext,
  ]);
};
