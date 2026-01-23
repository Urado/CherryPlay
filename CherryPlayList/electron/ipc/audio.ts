import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';
import * as mm from 'music-metadata';

import { validatePath } from '../utils/fsHelpers.js';

// Maximum file size for audio playback (200 MB)
// This prevents loading extremely large files that could cause memory issues
const MAX_AUDIO_FILE_SIZE = 200 * 1024 * 1024; // 200 MB in bytes

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

      // Verify file exists
      await fs.access(payload.path);

      const duration = await getAudioDuration(payload.path);
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

  ipcMain.handle('audio:getFileSource', async (event, payload: { path: string }) => {
    try {
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      // Check file existence and size before reading
      const stats = await fs.stat(payload.path);
      if (!stats.isFile()) {
        return {
          success: false,
          error: 'Path is not a file',
        };
      }

      if (stats.size > MAX_AUDIO_FILE_SIZE) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const maxMB = (MAX_AUDIO_FILE_SIZE / (1024 * 1024)).toFixed(0);
        return {
          success: false,
          error: `File too large: ${sizeMB} MB (maximum: ${maxMB} MB)`,
        };
      }

      const fileBuffer = await fs.readFile(payload.path);
      const extension = path.extname(payload.path).toLowerCase();
      const mimeType =
        {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.flac': 'audio/flac',
          '.m4a': 'audio/mp4',
          '.ogg': 'audio/ogg',
        }[extension] || 'audio/mpeg';

      return {
        success: true,
        data: {
          buffer: fileBuffer.toString('base64'),
          mimeType,
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
