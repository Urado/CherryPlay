import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';

import { isAudioFile, validatePath } from '../utils/fsHelpers.js';
import { logger } from '../utils/logger.js';

export interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

/**
 * List directory contents
 */
async function listDirectory(dirPath: string): Promise<DirectoryItem[]> {
  try {
    // Validate path exists and is a directory
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    // Read directory contents
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const items: DirectoryItem[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      try {
        const entryStats = await fs.stat(fullPath);
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entryStats.isDirectory(),
          size: entryStats.isFile() ? entryStats.size : undefined,
        });
      } catch (error) {
        // Skip entries that can't be accessed (permissions, etc.)
        logger.warn(`Cannot access ${fullPath}`, error);
      }
    }

    // Sort: directories first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return items;
  } catch (error) {
    throw new Error(`Failed to list directory: ${(error as Error).message}`);
  }
}

/**
 * Get file/directory stats
 */
async function statFile(filePath: string): Promise<{
  size: number;
  modified: number;
  isDirectory: boolean;
}> {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtimeMs,
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    throw new Error(`Failed to stat file: ${(error as Error).message}`);
  }
}

/**
 * Find all audio files recursively in a directory
 */
async function findAudioFilesRecursive(dirPath: string): Promise<string[]> {
  const audioFiles: string[] = [];

  async function traverse(currentPath: string): Promise<void> {
    try {
      const stats = await fs.stat(currentPath);

      if (stats.isDirectory()) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          await traverse(fullPath);
        }
      } else if (stats.isFile() && isAudioFile(currentPath)) {
        audioFiles.push(currentPath);
      }
    } catch (error) {
      // Skip entries that can't be accessed
      logger.warn(`Cannot access ${currentPath}`, error);
    }
  }

  await traverse(dirPath);
  return audioFiles;
}

/**
 * Register file browser IPC handlers
 */
export function registerFileBrowserHandlers(): void {
  ipcMain.handle('fileBrowser:listDirectory', async (event, payload: { path: string }) => {
    try {
      // Validate path to prevent path traversal attacks
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const items = await listDirectory(payload.path);
      return {
        success: true,
        data: items,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle('fileBrowser:statFile', async (event, payload: { path: string }) => {
    try {
      // Validate path to prevent path traversal attacks
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const stats = await statFile(payload.path);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle(
    'fileBrowser:findAudioFilesRecursive',
    async (event, payload: { path: string }) => {
      try {
        // Validate path to prevent path traversal attacks
        if (!validatePath(payload.path)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }

        const files = await findAudioFilesRecursive(payload.path);
        return {
          success: true,
          data: files,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );
}
