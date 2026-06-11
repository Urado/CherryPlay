import { useEffect, useRef } from 'react';

import { useProjectStore } from '@shared/stores';
import {
  syncDemoWithMainPlayer,
  syncMainWithDemoPlayer,
} from '@shared/stores/playbackDeviceConflictSync';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { logger } from '@shared/utils';

/**
 * Silently restores the player to the last session track on mount.
 * Runs once: if the component remounts (layout change), the ref guard
 * prevents re-loading a track that is already loaded.
 *
 * Waits for projectStore hydration to complete before attempting recovery,
 * because electronStorage (IndexedDB via localforage) is async and items
 * may still be empty at first render.
 */
export function useSessionRecovery(): void {
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    const runRecovery = () => {
      // Two-layer guard against double-loading:
      // 1. hasRestoredRef prevents double-fire within a single mount cycle (React Strict Mode
      //    unmounts+remounts in development, firing the effect twice).
      // 2. The store-level check below prevents re-loading when the component remounts due to
      //    a layout change while the track is already loaded. Do NOT remove the store check
      //    thinking the ref alone is sufficient — the ref resets on every real remount.
      if (hasRestoredRef.current) return;
      hasRestoredRef.current = true;

      const projectState = useProjectStore.getState();
      const { mode, currentTrackId } = projectState.sessionState;

      if (mode !== 'session') return;

      const { playerAudioDeviceId, demoPlayerAudioDeviceId } = useSettingsStore.getState();
      syncMainWithDemoPlayer(playerAudioDeviceId);
      syncDemoWithMainPlayer(demoPlayerAudioDeviceId);

      if (!currentTrackId) return;

      // Already loaded — user navigated away and back (remount guard, see comment above)
      if (usePlayerAudioStore.getState().currentTrack?.id === currentTrackId) return;

      const allTracks = projectState.getAllTracksInOrder();
      const track = allTracks.find((t) => t.id === currentTrackId);
      if (!track) return;

      // void: intentional floating promise — error is captured in playerAudioStore.error
      // and surfaced via the UI (red play button); no caller needs to await this.
      void usePlayerAudioStore
        .getState()
        .loadTrack(track)
        .catch((error) => {
          logger.error('Session recovery: failed to load track', error);
        });
    };

    // Check if already hydrated (component may mount after hydration completes)
    if (useProjectStore.persist.hasHydrated()) {
      runRecovery();
      return;
    }

    // Wait for hydration to complete before reading items from the store
    const unsub = useProjectStore.persist.onFinishHydration(() => {
      runRecovery();
      unsub();
    });
    return () => unsub();
  }, []); // empty deps — run once on mount
}
