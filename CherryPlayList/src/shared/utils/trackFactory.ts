import { v4 as uuidv4 } from 'uuid';

import { Track } from '../../core/types/track';

export type TrackDraft = Omit<Track, 'id'>;

export function extractName(path: string): string {
  const segments = path.split(/[/\\]/);
  const fallback = 'Unknown';
  return segments[segments.length - 1] || fallback;
}

export function createTrackDraft(path: string): TrackDraft {
  return {
    path,
    name: extractName(path),
    duration: undefined,
  };
}

export function createTrackDrafts(paths: string[]): TrackDraft[] {
  return paths.map(createTrackDraft);
}

/**
 * Создает трек с автоматически сгенерированным ID
 * Использует uuidv4() для генерации уникального идентификатора
 */
export function createTrackWithId(track: TrackDraft): Track {
  return {
    ...track,
    id: uuidv4(),
  };
}
