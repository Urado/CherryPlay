import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import type { ProgramTrack } from '@core/types/project';
import { usePlaybackPreview } from '@shared/hooks/usePlaybackPreview';
import {
  useAimpStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';
import {
  getPartyPlaybackSourceAdapter,
  resolvePartyPlaybackSourceState,
} from '@workspaces/party/partyPlaybackSource';
import { markPartyProgramEnded } from '@workspaces/party/partyProgramEndedStore';
import { usePartyWorkspaceStore } from '@workspaces/party/partyWorkspaceStore';
import { useCallback, useEffect, useRef } from 'react';

const tryMarkPartyProgramEndedFromCherryPlay = (): void => {
  const streamingSource = useSettingsStore.getState().streamingSource;
  const project = useProjectStore.getState();
  const adapter = getPartyPlaybackSourceAdapter(streamingSource);
  const playbackSourceState = resolvePartyPlaybackSourceState(streamingSource, {
    sessionMode: project.sessionState.mode,
    playerPlaybackStatus: usePlayerAudioStore.getState().status,
    aimpBridgeState: useAimpStore.getState().bridgeState,
  });
  if (adapter.completionDetection !== 'track-event') {
    return;
  }
  if (!playbackSourceState.sessionActive || !project.meta.linkedParty) {
    return;
  }
  if (usePartyWorkspaceStore.getState().partyLifecycleState !== 'ready') {
    return;
  }
  markPartyProgramEnded();
};

interface UsePlayerPlaybackOptions {
  allTracks: ProgramTrack[];
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: string;
    pauseBetweenTracks: number;
  };
  getNextActiveTrack: () => ProgramTrack | null;
  markTrackAsPlayed: (trackId: string) => void;
  markSkippedDisabledTracks: (fromIndex: number, toIndex: number) => void;
  setCurrentTrack: (trackId: string | null) => void;
}

export const usePlayerPlayback = (options: UsePlayerPlaybackOptions) => {
  const {
    allTracks,
    getEffectiveTrackSettings,
    getNextActiveTrack,
    markTrackAsPlayed,
    markSkippedDisabledTracks,
    setCurrentTrack,
  } = options;

  const mode = useProjectStore((state) => state.sessionState.mode);
  const isPreparationMode = mode === 'preparation';

  const {
    startPlayback: startTrackPlayback,
    pausePlayback,
    activeTrackId,
    playerStatus,
  } = usePlaybackPreview({
    workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
  });

  const {
    currentTrack: activePlayerTrack,
    status: playerAudioStatus,
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    setOnTrackEnded,
    setPauseTimer,
    clearPauseTimer,
    stop,
  } = usePlayerAudioStore();

  const activePlayerTrackId = activePlayerTrack?.id;

  const isProcessingTrackEndRef = useRef(false);

  const playerStateRef = useRef({
    status: playerAudioStatus,
    currentTrackId: activePlayerTrackId,
  });

  useEffect(() => {
    playerStateRef.current = {
      status: playerAudioStatus,
      currentTrackId: activePlayerTrackId,
    };
  }, [playerAudioStatus, activePlayerTrackId]);

  const handleTrackEnded = useCallback(async () => {
    if (!activePlayerTrackId || isPreparationMode) {
      return;
    }

    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentTrack = allTracks.find((t) => t.id === activePlayerTrackId);
      if (!currentTrack) {
        return;
      }

      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);

      markTrackAsPlayed(activePlayerTrackId);

      const settings = getEffectiveTrackSettings(activePlayerTrackId);

      if (settings.actionAfterTrack === 'pause') {
        if (!getNextActiveTrack()) {
          tryMarkPartyProgramEndedFromCherryPlay();
        }
        return;
      } else if (settings.actionAfterTrack === 'pauseAndNext') {
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          setPauseTimer(() => {
            const currentState = playerStateRef.current;
            if (currentState.status === 'paused' && currentState.currentTrackId === nextTrack.id) {
              void playPlayer();
            }
          }, settings.pauseBetweenTracks * 1000);
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          tryMarkPartyProgramEndedFromCherryPlay();
        }
      } else {
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          const loadGeneration = await loadPlayerTrack(nextTrack, true);
          setCurrentTrack(nextTrack.id);
          if (usePlayerAudioStore.getState().shouldAutoPlayTrack(nextTrack.id, loadGeneration)) {
            await playPlayer();
          }
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          tryMarkPartyProgramEndedFromCherryPlay();
        }
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    activePlayerTrackId,
    isPreparationMode,
    allTracks,
    markTrackAsPlayed,
    getEffectiveTrackSettings,
    getNextActiveTrack,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    markSkippedDisabledTracks,
    setPauseTimer,
  ]);

  const handleNext = useCallback(async () => {
    if (isPreparationMode || !activePlayerTrackId) {
      return;
    }

    clearPauseTimer();

    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
      markTrackAsPlayed(activePlayerTrackId);
      const nextTrack = getNextActiveTrack();
      if (nextTrack) {
        const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
        markSkippedDisabledTracks(currentIndex, nextIndex);
        const loadGeneration = await loadPlayerTrack(nextTrack, true);
        setCurrentTrack(nextTrack.id);
        if (usePlayerAudioStore.getState().shouldAutoPlayTrack(nextTrack.id, loadGeneration)) {
          await playPlayer();
        }
      } else {
        markSkippedDisabledTracks(currentIndex, allTracks.length);
        stop();
        tryMarkPartyProgramEndedFromCherryPlay();
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    isPreparationMode,
    activePlayerTrackId,
    allTracks,
    markTrackAsPlayed,
    getNextActiveTrack,
    markSkippedDisabledTracks,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    stop,
    clearPauseTimer,
  ]);

  useEffect(() => {
    if (!isPreparationMode) {
      setOnTrackEnded(() => {
        void handleTrackEnded();
      });
    } else {
      setOnTrackEnded(undefined);
    }
    return () => {
      setOnTrackEnded(undefined);
    };
  }, [isPreparationMode, handleTrackEnded, setOnTrackEnded]);

  return {
    startTrackPlayback,
    pausePlayback,
    handleNext,
    activeTrackId,
    playerStatus,
  };
};
