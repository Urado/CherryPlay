import { Track } from '../../core/types/track';

import { ipcService } from './ipcService';

export interface ExportResult {
  successful: string[];
  failed: Array<{ path: string; error: string }>;
}

class ExportService {
  /**
   * Export playlist with number prefix strategy
   * Files are copied with names like "01 - originalName.ext"
   */
  async exportWithNumberPrefix(tracks: Track[], targetPath: string): Promise<ExportResult> {
    // ipcService.invoke уже обрабатывает ошибки и показывает уведомления
    return await ipcService.invoke<ExportResult>('export:execute', {
      tracks,
      targetPath,
      strategy: 'copyWithNumberPrefix',
    });
  }

  /**
   * Export playlist to AIMP format (M3U8 with relative paths)
   */
  async exportAIMPPlaylist(
    tracks: Track[],
    targetPath: string,
    playlistName: string,
  ): Promise<{
    playlistPath: string;
    successful: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    // ipcService.invoke уже обрабатывает ошибки и показывает уведомления
    return await ipcService.invoke<{
      playlistPath: string;
      successful: string[];
      failed: Array<{ path: string; error: string }>;
    }>('export:aimp', {
      tracks,
      targetPath,
      playlistName,
    });
  }

  /**
   * Get available export strategies
   */
  getAvailableStrategies(): string[] {
    return ['copyWithNumberPrefix', 'aimpPlaylist'];
  }

  /**
   * Copy tracks into a new folder (with original filenames)
   */
  async copyTracksToFolder(
    tracks: Track[],
    targetPath: string,
    folderName: string,
  ): Promise<{
    folderPath: string;
    successful: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    return await ipcService.invoke<{
      folderPath: string;
      successful: string[];
      failed: Array<{ path: string; error: string }>;
    }>('export:copyTracksToFolder', {
      tracks,
      targetPath,
      folderName,
    });
  }
}

export const exportService = new ExportService();
