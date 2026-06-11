import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';
import * as mm from 'music-metadata';

import {
  encodePathToCherryplayAudioUrl,
  MAX_AUDIO_FILE_BYTES,
} from '../protocol/cherryplayAudio.js';
import { isAudioFile, validatePath } from '../utils/fsHelpers.js';

/**
 * Get audio file duration in seconds
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // Read file metadata
    const metadata = await mm.parseFile(filePath);

    // Get duration in seconds
    if (metadata.format.duration) {
      return Math.floor(metadata.format.duration);
    }

    throw new Error('Duration not found in audio file');
  } catch (error) {
    throw new Error(`Failed to get audio duration: ${(error as Error).message}`);
  }
}

/**
 * Register audio IPC handlers
 */
export function registerAudioHandlers(): void {
  ipcMain.handle('audio:getDuration', async (event, payload: { path: string }) => {
    try {
      // Validate path to prevent path traversal attacks
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const resolvedPath = path.resolve(payload.path);

      if (!isAudioFile(resolvedPath)) {
        return {
          success: false,
          error: 'Path is not an audio file',
        };
      }

      // Verify file exists and size before parsing metadata
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: 'Path is not a file',
        };
      }

      if (stats.size > MAX_AUDIO_FILE_BYTES) {
        return {
          success: false,
          error: 'Audio file exceeds maximum allowed size',
        };
      }

      await fs.access(resolvedPath);

      const duration = await getAudioDuration(resolvedPath);
      return {
        success: true,
        data: duration,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle('audio:getFileUrl', async (event, payload: { path: string }) => {
    try {
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const resolvedPath = path.resolve(payload.path);

      if (!isAudioFile(resolvedPath)) {
        return {
          success: false,
          error: 'Path is not an audio file',
        };
      }

      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: 'Path is not a file',
        };
      }

      if (stats.size > MAX_AUDIO_FILE_BYTES) {
        return {
          success: false,
          error: 'Audio file exceeds maximum allowed size',
        };
      }

      return {
        success: true,
        data: {
          url: encodePathToCherryplayAudioUrl(resolvedPath),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
