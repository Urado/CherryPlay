import { v4 as uuidv4 } from 'uuid';

import { Track } from '../../core/types/track';

export type TrackDraft = Omit<Track, 'id'>;

export const extractName = (path: string): string => {
  const segments = path.split(/[/\\]/);
  const fallback = 'Unknown';
  return segments[segments.length - 1] || fallback;
};

export const createTrackDraft = (path: string): TrackDraft => {
  return {
    path,
    name: extractName(path),
    duration: undefined,
  };
};

export const createTrackDrafts = (paths: string[]): TrackDraft[] => {
  return paths.map(createTrackDraft);
};

export const createTrackWithId = (track: TrackDraft): Track => {
  return {
    ...track,
    id: uuidv4(),
  };
};
