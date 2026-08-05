import { useCallback } from 'react';

import { Track } from '@core/types/track';
import {
  startDemoLiveMockPlayback,
  stopDemoLiveMockPlayback,
} from '@shared/demo/demoLiveMockPlayback';
import { isDemoLiveMode } from '@shared/platform';
import {
  usePlayerAudioStore,
  useProjectStore,
  useDemoPlayerStore,
  useSettingsStore,
} from '@shared/stores';
import { logger } from '@shared/utils';

interface UsePlayerSessionOptions {
  allTracks: Track[];
  isTrackActive: (trackId: string) => boolean;
  onSessionStart?: () => Promise<void> | void;
}

export function usePlayerSession(options: UsePlayerSessionOptions) {
  const { allTracks, isTrackActive, onSessionStart } = options;

  const { startSession, resetSession, setCurrentTrack } = useProjectStore();
  const {
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    pause: pausePlayer,
    clearPauseTimer,
  } = usePlayerAudioStore();

  const handleStartSession = useCallback(async () => {
    if (allTracks.length === 0) {
      return;
    }

    const hasActiveTracks = allTracks.some((track) => isTrackActive(track.id));
    if (!hasActiveTracks) {
      return;
    }

    startSession();

    const playerDeviceId = useSettingsStore.getState().playerAudioDeviceId;
    const demoDeviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
    if (playerDeviceId === demoDeviceId) {
      useDemoPlayerStore.getState().setDisabled(true);
    }

    if (onSessionStart) {
      try {
        await onSessionStart();
      } catch (error) {
        logger.error('Failed to start streaming', error);
      }
    }

    const firstActiveTrack = allTracks.find((track) => isTrackActive(track.id));

    if (firstActiveTrack) {
      try {
        if (isDemoLiveMode()) {
          startDemoLiveMockPlayback(firstActiveTrack);
          setCurrentTrack(firstActiveTrack.id);
        } else {
          await loadPlayerTrack(firstActiveTrack);
          setCurrentTrack(firstActiveTrack.id);
          await playPlayer();
        }
      } catch (error) {
        logger.error('Failed to start first track playback', error);
      }
    }
  }, [
    startSession,
    allTracks,
    isTrackActive,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    onSessionStart,
  ]);

  const handleResetSession = useCallback(() => {
    clearPauseTimer();
    stopDemoLiveMockPlayback();
    resetSession();
    pausePlayer();
    useDemoPlayerStore.getState().setDisabled(false);
  }, [resetSession, pausePlayer, clearPauseTimer]);

  return {
    handleStartSession,
    handleResetSession,
  };
}
