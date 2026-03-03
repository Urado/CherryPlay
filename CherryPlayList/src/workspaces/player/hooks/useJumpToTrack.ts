import { useCallback } from 'react';

import { useProjectStore } from '@shared/stores';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { logger } from '@shared/utils';

interface UseJumpToTrackResult {
  jumpToTrack: (targetTrackId: string) => Promise<void>;
}

export function useJumpToTrack(): UseJumpToTrackResult {
  const jumpToTrack = useCallback(async (targetTrackId: string) => {
    const store = useProjectStore.getState();
    const audioStore = usePlayerAudioStore.getState();

    const allTracks = store.getAllTracksInOrder();
    const targetTrack = allTracks.find((t) => t.id === targetTrackId);
    if (!targetTrack) return;

    const targetIndex = allTracks.indexOf(targetTrack);

    // Mark all tracks before the target as played in a single store update
    const toMark = allTracks.slice(0, targetIndex).map((t) => t.id);
    store.markTracksAsPlayed(toMark);

    // Enable target track if it or any ancestor group is disabled.
    // Re-enable ALL disabled ancestor groups (not just the first) to handle
    // deeply nested structures where multiple levels may be disabled.
    const path = store.getItemPath(targetTrackId);
    // path is [root, ..., targetId]; parent IDs are all except the last
    const parentIds = path.slice(0, -1);

    const disabledAncestors = parentIds.filter((ancestorId) => store.isGroupDisabled(ancestorId));

    if (disabledAncestors.length > 0) {
      // Re-enable each disabled ancestor group atomically.
      // NOTE: toggleGroupDisabled re-enables ALL tracks in the group, not just the
      // path to the target track. This is intentional — the group toggle is a bulk
      // operation and matches the behavior of the UI toggle.
      disabledAncestors.forEach((groupId) => store.toggleGroupDisabled(groupId));
    } else if (store.isTrackDisabled(targetTrackId)) {
      store.toggleTrackDisabled(targetTrackId);
    }

    // Load track into audio player (leaves it paused at position 0)
    try {
      await audioStore.loadTrack(targetTrack);
      // Set current track only after successful load
      store.setCurrentTrack(targetTrackId);
    } catch (err) {
      logger.error('Jump to track: failed to load track', err);
      // Do not update currentTrackId — keep the previous state consistent
    }
  }, []);

  return { jumpToTrack };
}
