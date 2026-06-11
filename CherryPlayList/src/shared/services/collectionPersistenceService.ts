import { Track } from '@core/types/track';

import { guardNativeFileOperation } from '../demo/guardNativeFileOperation';

import { exportService } from './exportService';
import { ipcService } from './ipcService';
import { playlistService, type PlaylistData } from './playlistService';

export interface ExportCollectionJsonParams {
  name: string;
  tracks: Track[];
}

export interface CopyCollectionTracksParams {
  tracks: Track[];
  folderName: string;
}

/**
 * Saves collection as JSON via native save dialog + IPC.
 * In web demo: shows «Не доступно в демо» and returns false.
 */
export async function exportCollectionAsJson(params: ExportCollectionJsonParams): Promise<boolean> {
  if (!guardNativeFileOperation()) {
    return false;
  }

  const { name, tracks } = params;
  const path = await ipcService.showSaveDialog({
    title: 'Экспортировать коллекцию',
    defaultPath: `${name}.json`,
    filters: [{ name: 'JSON файлы', extensions: ['json'] }],
  });

  if (!path) {
    return false;
  }

  const playlistData: PlaylistData = {
    name,
    tracks: tracks.map((track) => ({
      path: track.path,
      name: track.name,
      duration: track.duration,
    })),
  };

  await playlistService.savePlaylist(path, playlistData);
  return true;
}

/**
 * Copies collection tracks into a user-selected folder.
 * In web demo: shows «Не доступно в демо» and returns null.
 */
export async function copyCollectionTracksToFolder(params: CopyCollectionTracksParams): Promise<{
  folderPath: string;
  successful: string[];
  failed: Array<{ path: string; error: string }>;
} | null> {
  if (!guardNativeFileOperation()) {
    return null;
  }

  const targetPath = await ipcService.showFolderDialog({
    title: 'Выберите папку для копирования треков',
  });

  if (!targetPath) {
    return null;
  }

  return exportService.copyTracksToFolder(params.tracks, targetPath, params.folderName);
}

/**
 * Loads collection JSON from disk via open dialog + IPC.
 * In web demo: shows «Не доступно в демо» and returns null.
 */
export async function importCollectionFromJson(): Promise<PlaylistData | null> {
  if (!guardNativeFileOperation()) {
    return null;
  }

  const path = await ipcService.showOpenFileDialog({
    title: 'Импортировать коллекцию',
    filters: [{ name: 'JSON файлы', extensions: ['json'] }],
  });

  if (!path) {
    return null;
  }

  return playlistService.loadPlaylist(path);
}
