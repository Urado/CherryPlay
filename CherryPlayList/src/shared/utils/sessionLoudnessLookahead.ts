import { isProjectGroup } from '@core/types/project';
import type { ProjectItem } from '@core/types/project';
import type { Track } from '@core/types/track';

export const flattenProjectTracks = (items: ProjectItem[]): Track[] => {
  const tracks: Track[] = [];
  const visit = (entries: ProjectItem[]): void => {
    entries.forEach((item) => {
      if (isProjectGroup(item)) visit(item.items);
      else tracks.push(item);
    });
  };
  visit(items);
  return tracks;
};

export const getSessionLookaheadTracks = (
  tracks: Track[],
  currentTrackId: string,
  isTrackActive: (trackId: string) => boolean,
  limit = 3,
): Track[] => {
  const currentIndex = tracks.findIndex((track) => track.id === currentTrackId);
  if (currentIndex === -1 || limit <= 0) return [];
  const nextTracks: Track[] = [];
  for (let index = currentIndex + 1; index < tracks.length && nextTracks.length < limit; index++) {
    const track = tracks[index];
    if (track && isTrackActive(track.id)) nextTracks.push(track);
  }
  return nextTracks;
};
