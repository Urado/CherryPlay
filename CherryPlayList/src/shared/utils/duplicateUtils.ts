import { Track } from '@core/types/track';

import { DisplayItem, getTracksFromDisplayItems } from './playerItemsUtils';

const getFileNameWithExtension = (path: string | null | undefined): string | null => {
  if (!path) {
    return null;
  }

  const lastSeparatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const fileNameWithExtension = lastSeparatorIndex >= 0 ? path.slice(lastSeparatorIndex + 1) : path;

  return fileNameWithExtension || null;
};

export const getDuplicateTrackIdsByPathAndFilename = (tracks: Track[]): Set<string> => {
  const pathCount = new Map<string, number>();
  const fileNameCount = new Map<string, number>();
  const fileNameByTrackId = new Map<string, string | null>();
  const pathByTrackId = new Map<string, string | null>();

  for (const track of tracks) {
    const path = typeof track.path === 'string' && track.path.length > 0 ? track.path : null;
    pathByTrackId.set(track.id, path);
    if (path) {
      pathCount.set(path, (pathCount.get(path) ?? 0) + 1);
    }

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
    const path = pathByTrackId.get(track.id);
    const fileNameWithExtension = fileNameByTrackId.get(track.id);

    if (
      (path && duplicatePaths.has(path)) ||
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
