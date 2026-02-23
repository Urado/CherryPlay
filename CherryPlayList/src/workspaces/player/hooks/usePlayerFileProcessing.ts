import { useCallback } from 'react';

import { Track } from '@core/types/track';
import { fileService, ipcService } from '@shared/services';
import { useProjectStore } from '@shared/stores';
import { logger } from '@shared/utils';
import { createTrackWithId, extractName } from '@shared/utils/trackFactory';

const DEFAULT_GROUP_INSERT_INDEX = 0;

export interface FileSource {
  type: 'files' | 'directories';
  paths: string[];
}

interface ProcessingTarget {
  type: 'group' | 'position';
  id?: string; // groupId для type: 'group'
  index?: number; // insertIndex для type: 'position' или 'group'
}

/**
 * Универсальный хук для обработки файлов и директорий
 * Объединяет логику 6 функций: processFilesToGroup, processDirectoriesToGroup,
 * processFilesToPosition, processDirectoriesToPosition, processFilesToGroupAtPosition,
 * processDirectoriesToGroupAtPosition
 */
export function usePlayerFileProcessing() {
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

      // Обрабатываем файлы
      const fileSources = sources.filter((s) => s.type === 'files');
      if (fileSources.length > 0) {
        const allFiles = fileSources.flatMap((s) => s.paths);
        const validFiles = allFiles.filter((path) => fileService.isValidAudioFile(path));
        if (validFiles.length > 0) {
          await processFiles(validFiles, target, loadDurationsForTracks, addItem);
        }
      }

      // Обрабатываем директории
      const directorySources = sources.filter((s) => s.type === 'directories');
      if (directorySources.length > 0 && ipcService.findAudioFilesRecursive) {
        for (const dirSource of directorySources) {
          for (const dir of dirSource.paths) {
            try {
              const paths = await ipcService.findAudioFilesRecursive(dir);
              const validPaths = paths.filter((path) => fileService.isValidAudioFile(path));
              if (validPaths.length > 0) {
                await processFiles(validPaths, target, loadDurationsForTracks, addItem);
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
}

/**
 * Обрабатывает файлы и добавляет их в указанное место
 */
async function processFiles(
  filePaths: string[],
  target: ProcessingTarget,
  loadDurationsForTracks: (paths: string[]) => void,
  addItem: (item: Omit<Track, 'id'>, index?: number) => void,
) {
  if (filePaths.length === 0) return;

  const tracks = filePaths.map((path) => ({
    path,
    name: extractName(path),
  }));

  if (target.type === 'group' && target.id) {
    // Добавляем в группу
    const { addItemToGroup } = useProjectStore.getState();
    const insertIndex = target.index ?? DEFAULT_GROUP_INSERT_INDEX;

    tracks.forEach((track, idx) => {
      const trackWithId = createTrackWithId(track);
      // Сначала добавляем в корневой список
      addItem(trackWithId);
      // Затем перемещаем в группу
      addItemToGroup(target.id!, trackWithId.id, insertIndex + idx);
      loadDurationsForTracks([{ id: trackWithId.id, path: trackWithId.path }]);
    });
  } else if (target.type === 'position' && target.index !== undefined) {
    // Добавляем в позицию
    const tracksWithIds = tracks.map(createTrackWithId);
    tracksWithIds.forEach((track) => addItem(track, target.index));
    const targetList = tracksWithIds.map((t) => ({ id: t.id, path: t.path }));
    loadDurationsForTracks(targetList);
  }
}
