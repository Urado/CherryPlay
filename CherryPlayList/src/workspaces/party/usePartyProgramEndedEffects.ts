import { useEffect, useRef } from 'react';

import {
  useAimpStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';

import { detectAimpLiveProgramEnded } from './detectAimpLiveProgramEnded';
import {
  clearPartyProgramEnded,
  markPartyProgramEnded,
  usePartyProgramEndedStore,
} from './partyProgramEndedStore';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';

function collectActiveTrackIds(
  items: ReadonlyArray<{ id: string; type: string }>,
  disabledTrackIds: ReadonlyArray<string>,
): string[] {
  const disabled = new Set(disabledTrackIds);
  return items
    .filter((item) => item.type === 'track' && !disabled.has(item.id))
    .map((item) => item.id);
}

function isReadyLivePartyContext(): boolean {
  const project = useProjectStore.getState();
  if (project.sessionState.mode !== 'session' || !project.meta.linkedParty) {
    return false;
  }
  return usePartyWorkspaceStore.getState().partyLifecycleState === 'ready';
}

export function usePartyProgramEndedEffects(): void {
  const programEnded = usePartyProgramEndedStore((state) => state.programEnded);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const linkedParty = useProjectStore((state) => state.meta.linkedParty);
  const items = useProjectStore((state) => state.items);
  const disabledTrackIds = useProjectStore((state) => state.sessionState.disabledTrackIds);
  const playbackStatus = usePlayerAudioStore((state) => state.status);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);

  const playlistSignature = `${items.map((item) => `${item.type}:${item.id}`).join('|')}#${disabledTrackIds.join(',')}`;
  const aimpPlaylistRevision = aimpBridgeState.playlistSnapshot?.revision ?? null;
  const aimpTrackCount = aimpBridgeState.playlistSnapshot?.trackCount ?? 0;
  const aimpPlaybackStatus = aimpBridgeState.playbackSnapshot?.status ?? null;
  const aimpLive = aimpBridgeState.liveStreamStarted;

  const prevPlaylistSignatureRef = useRef(playlistSignature);
  const prevAimpTrackCountRef = useRef(aimpTrackCount);
  const sawAimpPlayingRef = useRef(false);

  useEffect(() => {
    if (sessionMode !== 'session') {
      clearPartyProgramEnded();
    }
  }, [sessionMode]);

  useEffect(() => {
    if (partyLifecycleState === 'completed' || !linkedParty) {
      clearPartyProgramEnded();
    }
  }, [partyLifecycleState, linkedParty]);

  useEffect(() => {
    if (!aimpLive && streamingSource === 'aimp') {
      clearPartyProgramEnded();
    }
  }, [aimpLive, streamingSource]);

  useEffect(() => {
    if (!programEnded) {
      return;
    }
    if (playbackStatus === 'playing') {
      clearPartyProgramEnded();
    }
  }, [programEnded, playbackStatus]);

  useEffect(() => {
    if (!programEnded) {
      return;
    }
    if (streamingSource === 'aimp' && aimpPlaybackStatus === 'playing') {
      clearPartyProgramEnded();
    }
  }, [programEnded, streamingSource, aimpPlaybackStatus]);

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
      prevAimpTrackCountRef.current = aimpTrackCount;
      return;
    }
    if (streamingSource !== 'aimp') {
      return;
    }
    if (aimpTrackCount > prevAimpTrackCountRef.current) {
      clearPartyProgramEnded();
    }
    prevAimpTrackCountRef.current = aimpTrackCount;
  }, [programEnded, streamingSource, aimpTrackCount, aimpPlaylistRevision]);

  useEffect(() => {
    if (streamingSource !== 'aimp' || !aimpLive) {
      sawAimpPlayingRef.current = false;
      return;
    }
    if (aimpPlaybackStatus === 'playing') {
      sawAimpPlayingRef.current = true;
      return;
    }
    if (!sawAimpPlayingRef.current || programEnded || !isReadyLivePartyContext()) {
      return;
    }
    if (detectAimpLiveProgramEnded(aimpBridgeState)) {
      markPartyProgramEnded();
    }
  }, [
    streamingSource,
    aimpLive,
    aimpPlaybackStatus,
    aimpBridgeState,
    programEnded,
    aimpPlaylistRevision,
    linkedParty,
    partyLifecycleState,
    sessionMode,
  ]);
}
