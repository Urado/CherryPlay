import { Track } from '@core/types/track';

import { DisplayItem, getTracksFromDisplayItems } from './playerItemsUtils';

const getFileNameWithExtension = (path: string): string | null => {
  const lastSeparatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const fileNameWithExtension = lastSeparatorIndex >= 0 ? path.slice(lastSeparatorIndex + 1) : path;

  return fileNameWithExtension || null;
};

export const getDuplicateTrackIdsByPathAndFilename = (tracks: Track[]): Set<string> => {
  const pathCount = new Map<string, number>();
  const fileNameCount = new Map<string, number>();
  const fileNameByTrackId = new Map<string, string | null>();

  for (const track of tracks) {
    const path = track.path;
    pathCount.set(path, (pathCount.get(path) ?? 0) + 1);

    const fileNameWithExtension = getFileNameWithExtension(path);
    fileNameByTrackId.set(track.id, fileNameWithExtension);

    if (fileNameWithExtension) {
      fileNameCount.set(fileNameWithExtension, (fileNameCount.get(fileNameWithExtension) ?? 0) + 1);
    }
  }

  const duplicatePaths = new Set(
    [...pathCount.entries()].filter(([, count]) => count > 1).map(([path]) => path),
  );

  const duplicateFileNames = new Set(
    [...fileNameCount.entries()].filter(([, count]) => count > 1).map(([fileName]) => fileName),
  );

  const duplicateIds = new Set<string>();

  for (const track of tracks) {
    const path = track.path;
    const fileNameWithExtension = fileNameByTrackId.get(track.id);

    if (
      duplicatePaths.has(path) ||
      (fileNameWithExtension && duplicateFileNames.has(fileNameWithExtension))
    ) {
      duplicateIds.add(track.id);
    }
  }

  return duplicateIds;
};

export const getDuplicateTrackIdsFromDisplayItems = (displayItems: DisplayItem[]): Set<string> => {
  const tracks = getTracksFromDisplayItems(displayItems);
  return getDuplicateTrackIdsByPathAndFilename(tracks);
};
