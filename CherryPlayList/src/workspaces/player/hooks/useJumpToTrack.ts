import { useProjectStore } from '@shared/stores';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { logger } from '@shared/utils';
import { useCallback } from 'react';

interface UseJumpToTrackResult {
  jumpToTrack: (targetTrackId: string) => Promise<void>;
}

export const useJumpToTrack = (): UseJumpToTrackResult => {
  const jumpToTrack = useCallback(async (targetTrackId: string) => {
    const store = useProjectStore.getState();
    const audioStore = usePlayerAudioStore.getState();

    const allTracks = store.getAllTracksInOrder();
    const targetTrack = allTracks.find((t) => t.id === targetTrackId);
    if (!targetTrack) return;

    const targetIndex = allTracks.indexOf(targetTrack);

    const beforeTargetIds = allTracks.slice(0, targetIndex).map((t) => t.id);
    const fromTargetIds = allTracks.slice(targetIndex).map((t) => t.id);
    store.markTracksAsPlayed(beforeTargetIds);
    store.unmarkTracksAsPlayed(fromTargetIds);

    const path = store.getItemPath(targetTrackId);
    const parentIds = path.slice(0, -1);

    const disabledAncestors = parentIds.filter((ancestorId) => store.isGroupDisabled(ancestorId));

    if (disabledAncestors.length > 0) {
      disabledAncestors.forEach((groupId) => store.toggleGroupDisabled(groupId));
    } else if (store.isTrackDisabled(targetTrackId)) {
      store.toggleTrackDisabled(targetTrackId);
    }

    try {
      await audioStore.loadTrack(targetTrack);
      store.setCurrentTrack(targetTrackId);
    } catch (err) {
      logger.error('Jump to track: failed to load track', err);
    }
  }, []);

  return { jumpToTrack };
};
