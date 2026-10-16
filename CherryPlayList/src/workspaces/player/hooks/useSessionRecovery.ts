import { useProjectStore } from '@shared/stores';
import {
  syncDemoWithMainPlayer,
  syncMainWithDemoPlayer,
} from '@shared/stores/playbackDeviceConflictSync';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { logger } from '@shared/utils';
import { useEffect, useRef } from 'react';

export const useSessionRecovery = (): void => {
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    const runRecovery = () => {
      if (hasRestoredRef.current) return;
      hasRestoredRef.current = true;

      const projectState = useProjectStore.getState();
      const { mode, currentTrackId } = projectState.sessionState;

      if (mode !== 'session') return;

      const { playerAudioDeviceId, demoPlayerAudioDeviceId } = useSettingsStore.getState();
      syncMainWithDemoPlayer(playerAudioDeviceId);
      syncDemoWithMainPlayer(demoPlayerAudioDeviceId);

      if (!currentTrackId) return;

      if (usePlayerAudioStore.getState().currentTrack?.id === currentTrackId) return;

      const allTracks = projectState.getAllTracksInOrder();
      const track = allTracks.find((t) => t.id === currentTrackId);
      if (!track) return;

      void usePlayerAudioStore
        .getState()
        .loadTrack(track)
        .catch((error) => {
          logger.error('Session recovery: failed to load track', error);
        });
    };

    if (useProjectStore.persist.hasHydrated()) {
      runRecovery();
      return;
    }

    const unsub = useProjectStore.persist.onFinishHydration(() => {
      runRecovery();
      unsub();
    });
    return () => unsub();
  }, []);
};
