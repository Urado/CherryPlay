import { ProjectItem, isProjectGroup, isProjectTrack, ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';

export interface ItemState {
  isPlayed: boolean;
  isDisabled: boolean;
}

export const getItemState = (
  item: ProjectItem,
  isTrackPlayed: (id: string) => boolean,
  isGroupDisabled: (id: string) => boolean,
  isTrackOrGroupDisabled: (id: string) => boolean,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
): ItemState => {
  if (isProjectGroup(item)) {
    const groupTracks = getAllTracksInOrder([item]);
    const isPlayed = groupTracks.length > 0 && groupTracks.every((t) => isTrackPlayed(t.id));
    const isDisabled = isGroupDisabled(item.id);
    return { isPlayed, isDisabled };
  } else if (isProjectTrack(item)) {
    const isPlayed = isTrackPlayed(item.id);
    const isDisabled = isTrackOrGroupDisabled(item.id);
    return { isPlayed, isDisabled };
  }
  return { isPlayed: false, isDisabled: false };
};

export const isItemLocked = (
  item: ProjectItem,
  isPreparationMode: boolean,
  activePlayerTrackId: string | null | undefined,
  itemState: ItemState,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
  isTrackPlayed: (id: string) => boolean,
): boolean => {
  if (isPreparationMode) {
    return false;
  }

  const track = isProjectTrack(item) ? item : null;
  const isCurrentTrack = track?.id === activePlayerTrackId;

  if (itemState.isPlayed || isCurrentTrack) {
    return true;
  }

  if (isProjectGroup(item)) {
    const groupTracks = getAllTracksInOrder([item]);
    return groupTracks.some((t) => isTrackPlayed(t.id) || t.id === activePlayerTrackId);
  }

  return false;
};

export const calculateGroupDurationWithPauses = (
  group: ProjectItem,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: ActionAfterTrack;
    pauseBetweenTracks: number;
  },
): number | undefined => {
  if (!isProjectGroup(group)) {
    return undefined;
  }

  const groupTracks = getAllTracksInOrder([group]);
  let total = 0;

  for (let i = 0; i < groupTracks.length; i++) {
    const groupTrack = groupTracks[i];
    total += groupTrack.duration || 0;
    const settings = getEffectiveTrackSettings(groupTrack.id);
    if (settings.actionAfterTrack === 'pauseAndNext') {
      total += settings.pauseBetweenTracks || 0;
    }
  }

  const hasAnyDuration = groupTracks.some((t) => t.duration && t.duration > 0);
  return hasAnyDuration ? total : undefined;
};
