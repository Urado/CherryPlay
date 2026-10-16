import { Track } from '@core/types/track';
import { fileService, ipcService } from '@shared/services';
import { useProjectStore } from '@shared/stores';
import { logger } from '@shared/utils';
import { createTrackWithId, extractName } from '@shared/utils/trackFactory';
import { useCallback } from 'react';

const DEFAULT_GROUP_INSERT_INDEX = 0;

export interface FileSource {
  type: 'files' | 'directories';
  paths: string[];
}

interface ProcessingTarget {
  type: 'group' | 'position';
  id?: string;
  index?: number;
}

export const usePlayerFileProcessing = () => {
  const { addItem } = useProjectStore((state) => ({
    addItem: state.addItem,
  }));

  const processSources = useCallback(
    async (
      sources: FileSource[],
      target: ProcessingTarget,
      loadDurationsForTracks: (targets: Array<{ id: string; path: string }>) => void,
    ) => {
      if (sources.length === 0) return;

      const fileSources = sources.filter((s) => s.type === 'files');
      if (fileSources.length > 0) {
        const allFiles = fileSources.flatMap((s) => s.paths);
        const validFiles = allFiles.filter((path) => fileService.isValidAudioFile(path));
        if (validFiles.length > 0) {
          processFiles(validFiles, target, loadDurationsForTracks, addItem);
        }
      }

      const directorySources = sources.filter((s) => s.type === 'directories');
      if (directorySources.length > 0 && ipcService.findAudioFilesRecursive) {
        for (const dirSource of directorySources) {
          for (const dir of dirSource.paths) {
            try {
              const paths = await ipcService.findAudioFilesRecursive(dir);
              const validPaths = paths.filter((path) => fileService.isValidAudioFile(path));
              if (validPaths.length > 0) {
                processFiles(validPaths, target, loadDurationsForTracks, addItem);
              }
            } catch (error) {
              logger.error('Failed to load folder tracks', error);
            }
          }
        }
      }
    },
    [addItem],
  );

  return { processSources };
};

const processFiles = (
  filePaths: string[],
  target: ProcessingTarget,
  loadDurationsForTracks: (paths: string[]) => void,
  addItem: (item: Omit<Track, 'id'>, index?: number) => void,
): void => {
  if (filePaths.length === 0) return;

  const tracks = filePaths.map((path) => ({
    path,
    name: extractName(path),
  }));

  if (target.type === 'group' && target.id) {
    const { addItemToGroup } = useProjectStore.getState();
    const insertIndex = target.index ?? DEFAULT_GROUP_INSERT_INDEX;

    tracks.forEach((track, idx) => {
      const trackWithId = createTrackWithId(track);
      addItem(trackWithId);
      addItemToGroup(target.id!, trackWithId.id, insertIndex + idx);
      loadDurationsForTracks([{ id: trackWithId.id, path: trackWithId.path }]);
    });
  } else if (target.type === 'position' && target.index !== undefined) {
    const tracksWithIds = tracks.map(createTrackWithId);
    tracksWithIds.forEach((track) => addItem(track, target.index));
    const targetList = tracksWithIds.map((t) => ({ id: t.id, path: t.path }));
    loadDurationsForTracks(targetList);
  }
};
