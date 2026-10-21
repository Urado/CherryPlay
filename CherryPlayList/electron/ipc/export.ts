import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';

import {
  copyFileWithRetry,
  ensureFolder,
  safeFileName,
  getRelativePath,
  validatePath,
} from '../utils/fsHelpers.js';

export interface Track {
  id: string;
  path: string;
  name: string;
  duration?: number;
}

export interface ExportResult {
  successful: string[];
  failed: Array<{ path: string; error: string }>;
}

const exportWithNumberPrefix = async (
  tracks: Track[],
  targetPath: string,
): Promise<ExportResult> => {
  const result: ExportResult = {
    successful: [],
    failed: [],
  };

  try {
    await ensureFolder(targetPath);

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const number = (i + 1).toString().padStart(2, '0');
      const ext = path.extname(track.path);
      const originalName = path.basename(track.path, ext);
      const newName = `${number} - ${safeFileName(originalName)}${ext}`;
      const destPath = path.join(targetPath, newName);

      try {
        await fs.access(track.path);
        await copyFileWithRetry(track.path, destPath);
        result.successful.push(track.path);
      } catch (error) {
        result.failed.push({
          path: track.path,
          error: (error as Error).message,
        });
      }
    }
  } catch (error) {
    throw new Error(`Export failed: ${(error as Error).message}`);
  }

  return result;
};

const exportAIMPPlaylist = async (
  tracks: Track[],
  targetPath: string,
  playlistName: string,
): Promise<{
  playlistPath: string;
  successful: string[];
  failed: Array<{ path: string; error: string }>;
}> => {
  const result: { successful: string[]; failed: Array<{ path: string; error: string }> } = {
    successful: [],
    failed: [],
  };

  try {
    const safePlaylistName = safeFileName(playlistName || 'Playlist');
    const playlistFolder = path.join(targetPath, safePlaylistName);
    await ensureFolder(playlistFolder);

    for (const track of tracks) {
      const fileName = path.basename(track.path);
      const destPath = path.join(playlistFolder, fileName);

      try {
        await fs.access(track.path);
        await copyFileWithRetry(track.path, destPath);
        result.successful.push(track.path);
      } catch (error) {
        result.failed.push({
          path: track.path,
          error: (error as Error).message,
        });
      }
    }

    const playlistFilePath = path.join(playlistFolder, `${safePlaylistName}.m3u8`);
    const playlistContent: string[] = ['#EXTM3U'];

    for (const track of tracks) {
      const fileName = path.basename(track.path);
      const relativePath = getRelativePath(playlistFilePath, path.join(playlistFolder, fileName));
      playlistContent.push(relativePath);
    }

    const bom = '\uFEFF';
    await fs.writeFile(playlistFilePath, bom + playlistContent.join('\n'), 'utf8');

    return {
      playlistPath: playlistFilePath,
      ...result,
    };
  } catch (error) {
    throw new Error(`AIMP export failed: ${(error as Error).message}`);
  }
};

const copyTracksToFolder = async (
  tracks: Track[],
  targetPath: string,
  folderName: string,
): Promise<{
  folderPath: string;
  successful: string[];
  failed: Array<{ path: string; error: string }>;
}> => {
  const result: { successful: string[]; failed: Array<{ path: string; error: string }> } = {
    successful: [],
    failed: [],
  };

  try {
    const safeFolderName = safeFileName(folderName || 'Collection');
    const destinationFolder = path.join(targetPath, safeFolderName);
    await ensureFolder(destinationFolder);

    for (const track of tracks) {
      const fileName = path.basename(track.path);
      const extension = path.extname(fileName);
      const baseName = path.basename(fileName, extension);
      let destPath = path.join(destinationFolder, fileName);

      try {
        await fs.access(track.path);
        if (path.resolve(track.path) !== path.resolve(destPath)) {
          let suffix = 2;
          while (true) {
            try {
              await fs.access(destPath);
              destPath = path.join(destinationFolder, `${baseName}_${suffix}${extension}`);
              suffix++;
            } catch {
              break;
            }
          }
          await copyFileWithRetry(track.path, destPath);
        }
        result.successful.push(track.path);
      } catch (error) {
        result.failed.push({
          path: track.path,
          error: (error as Error).message,
        });
      }
    }

    return {
      folderPath: destinationFolder,
      ...result,
    };
  } catch (error) {
    throw new Error(`Copy failed: ${(error as Error).message}`);
  }
};

export const registerExportHandlers = (): void => {
  ipcMain.handle(
    'export:execute',
    async (
      event,
      payload: {
        tracks: Track[];
        targetPath: string;
        strategy: string;
      },
    ) => {
      try {
        if (!validatePath(payload.targetPath)) {
          return {
            success: false,
            error: 'Invalid target path: path traversal detected',
          };
        }

        for (const track of payload.tracks) {
          if (!validatePath(track.path)) {
            return {
              success: false,
              error: `Invalid track path: ${track.path} - path traversal detected`,
            };
          }
        }

        let result: ExportResult;

        if (payload.strategy === 'copyWithNumberPrefix') {
          result = await exportWithNumberPrefix(payload.tracks, payload.targetPath);
        } else {
          throw new Error(`Unknown export strategy: ${payload.strategy}`);
        }

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle(
    'export:aimp',
    async (
      event,
      payload: {
        tracks: Track[];
        targetPath: string;
        playlistName: string;
      },
    ) => {
      try {
        if (!validatePath(payload.targetPath)) {
          return {
            success: false,
            error: 'Invalid target path: path traversal detected',
          };
        }

        for (const track of payload.tracks) {
          if (!validatePath(track.path)) {
            return {
              success: false,
              error: `Invalid track path: ${track.path} - path traversal detected`,
            };
          }
        }

        const result = await exportAIMPPlaylist(
          payload.tracks,
          payload.targetPath,
          payload.playlistName,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle(
    'export:copyTracksToFolder',
    async (
      event,
      payload: {
        tracks: Track[];
        targetPath: string;
        folderName: string;
      },
    ) => {
      try {
        if (!validatePath(payload.targetPath)) {
          return {
            success: false,
            error: 'Invalid target path: path traversal detected',
          };
        }

        for (const track of payload.tracks) {
          if (!validatePath(track.path)) {
            return {
              success: false,
              error: `Invalid track path: ${track.path} - path traversal detected`,
            };
          }
        }

        const result = await copyTracksToFolder(
          payload.tracks,
          payload.targetPath,
          payload.folderName,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );
};
