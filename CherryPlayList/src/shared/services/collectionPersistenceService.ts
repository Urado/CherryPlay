import { guardNativeFileOperation } from '../demo/guardNativeFileOperation';

import { ipcService } from './ipcService';
import { playlistService, type PlaylistData } from './playlistService';

export const importCollectionFromJson = async (): Promise<PlaylistData | null> => {
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
};
