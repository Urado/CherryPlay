import { isProjectGroup, ProjectItem, type ProgramTrack } from '@core/types/project';

export const getActionsTargetTrackId = (
  item: ProjectItem,
  getAllTracksInOrder: (items: ProjectItem[]) => ProgramTrack[],
): string | undefined => {
  if (isProjectGroup(item)) {
    return getAllTracksInOrder([item])[0]?.id;
  }
  return item.id;
};

export const isTrackActionsMenuDisabled = (
  jumpToTrack: ((trackId: string) => Promise<void>) | undefined,
  actionsTargetTrackId: string | undefined,
  activePlayerTrackId: string | null | undefined,
): boolean =>
  !jumpToTrack || !actionsTargetTrackId || actionsTargetTrackId === activePlayerTrackId;
