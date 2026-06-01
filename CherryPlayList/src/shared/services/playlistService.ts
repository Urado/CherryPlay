import { guardNativeFileOperation } from '../demo/guardNativeFileOperation';

import { ipcService } from './ipcService';

/**
 * Простой формат плейлиста для экспорта коллекции
 */
export interface PlaylistData {
  name: string;
  tracks: {
    path: string;
    name: string;
    duration?: number;
  }[];
}

/**
 * Сервис для экспорта/импорта плейлистов в простом формате JSON
 * Используется для экспорта коллекции, не связан с Project Store
 */
class PlaylistService {
  async savePlaylist(path: string, data: PlaylistData): Promise<void> {
    if (!guardNativeFileOperation()) {
      return;
    }
    await ipcService.invoke('playlist:save', { path, data });
  }

  async loadPlaylist(path: string): Promise<PlaylistData> {
    if (!guardNativeFileOperation()) {
      throw new Error('Не доступно в демо');
    }
    return await ipcService.invoke('playlist:load', { path });
  }
}

export const playlistService = new PlaylistService();
