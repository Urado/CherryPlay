import { create } from 'zustand';

import type { PlayerItemForApi } from '../utils/partyUtils';

import type { PlaylistForApiPayload } from './PlaybackBroadcastSource';

export function collectFlattenedTrackIdsFromApiItems(items: PlayerItemForApi[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.type === 'track') {
      ids.push(item.id);
    } else if (item.type === 'group' && item.items) {
      ids.push(...collectFlattenedTrackIdsFromApiItems(item.items));
    }
  }
  return ids;
}

interface ServerPlaylistTrackIdsState {
  serverTrackIds: Set<string> | null;
  syncGeneration: number;
  setFromIdList: (ids: string[] | null | undefined, requestGeneration?: number) => void;
  setFromPlaylistItems: (items: PlayerItemForApi[]) => void;
  clear: () => void;
}

const toServerTrackIdsSet = (ids: string[]): Set<string> | null =>
  ids.length > 0 ? new Set(ids) : null;

export const useServerPlaylistTrackIdsStore = create<ServerPlaylistTrackIdsState>((set) => ({
  serverTrackIds: null,
  syncGeneration: 0,
  setFromIdList: (ids, requestGeneration) =>
    set((state) => {
      if (requestGeneration !== undefined && state.syncGeneration > requestGeneration) {
        return state;
      }
      return {
        serverTrackIds: ids == null ? null : toServerTrackIdsSet(ids),
      };
    }),
  setFromPlaylistItems: (items) =>
    set((state) => ({
      syncGeneration: state.syncGeneration + 1,
      serverTrackIds: toServerTrackIdsSet(collectFlattenedTrackIdsFromApiItems(items)),
    })),
  clear: () => set({ serverTrackIds: null }),
}));

export function applySyncedPlaylistTrackIds(payload: PlaylistForApiPayload): void {
  useServerPlaylistTrackIdsStore.getState().setFromPlaylistItems(payload.items);
}

export function clearServerPlaylistTrackIds(): void {
  useServerPlaylistTrackIdsStore.getState().clear();
}
