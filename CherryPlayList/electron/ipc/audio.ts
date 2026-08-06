import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';
import * as mm from 'music-metadata';

import {
  analyzeLoudness,
  DEFAULT_TARGET_LUFS,
  MAX_TARGET_LUFS,
  MIN_TARGET_LUFS,
} from '../audio/loudnessScanner.js';
import {
  encodePathToCherryplayAudioUrl,
  MAX_AUDIO_FILE_BYTES,
} from '../protocol/cherryplayAudio.js';
import { isAudioFile, normalizeStatNumber, validatePath } from '../utils/fsHelpers.js';

type AudioPathValidationResult =
  | { ok: true; resolvedPath: string; stats: Awaited<ReturnType<typeof fs.stat>> }
  | { ok: false; error: string };

async function validateAudioFilePath(userPath: string): Promise<AudioPathValidationResult> {
  if (!validatePath(userPath)) {
    return { ok: false, error: 'Invalid path: path traversal detected' };
  }

  const resolvedPath = path.resolve(userPath);

  if (!isAudioFile(resolvedPath)) {
    return { ok: false, error: 'Path is not an audio file' };
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return { ok: false, error: 'Path is not a file' };
    }

    if (normalizeStatNumber(stats.size) > MAX_AUDIO_FILE_BYTES) {
      return { ok: false, error: 'Audio file exceeds maximum allowed size' };
    }

    return { ok: true, resolvedPath, stats };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

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
      const validation = await validateAudioFilePath(payload.path);
      if (!validation.ok) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const { resolvedPath } = validation;

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
      const validation = await validateAudioFilePath(payload.path);
      if (!validation.ok) {
        return {
          success: false,
          error: validation.error,
        };
      }

      return {
        success: true,
        data: {
          url: encodePathToCherryplayAudioUrl(validation.resolvedPath),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * IPC envelope for loudness analysis (subtask 03 relies on this contract):
   * - Path / payload validation failures → `{ success: false, error: string }`
   * - Scan completed (including FFmpeg/parse failures) → `{ success: true, data: LoudnessScanResult }`
   *   where scan failures use `data.status === 'error'` rather than `success: false`.
   * - Unexpected handler exceptions → `{ success: false, error: string }`
   */
  ipcMain.handle(
    'audio:analyzeLoudness',
    async (
      event,
      payload: {
        path: string;
        targetLufs?: number;
      },
    ) => {
      try {
        const validation = await validateAudioFilePath(payload.path);
        if (!validation.ok) {
          return {
            success: false,
            error: validation.error,
          };
        }

        let targetLufs = DEFAULT_TARGET_LUFS;
        if (typeof payload.targetLufs === 'number' && Number.isFinite(payload.targetLufs)) {
          if (payload.targetLufs < MIN_TARGET_LUFS || payload.targetLufs > MAX_TARGET_LUFS) {
            return {
              success: false,
              error: `targetLufs must be between ${MIN_TARGET_LUFS} and ${MAX_TARGET_LUFS}`,
            };
          }
          targetLufs = payload.targetLufs;
        }

        const result = await analyzeLoudness(validation.resolvedPath, targetLufs, {
          fileMtime: normalizeStatNumber(validation.stats.mtimeMs),
          fileSizeBytes: normalizeStatNumber(validation.stats.size),
        });
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

  ipcMain.handle('audio:statAudioFile', async (event, payload: { path: string }) => {
    try {
      const validation = await validateAudioFilePath(payload.path);
      if (!validation.ok) {
        return {
          success: false,
          error: validation.error,
        };
      }

      return {
        success: true,
        data: {
          mtimeMs: normalizeStatNumber(validation.stats.mtimeMs),
          size: normalizeStatNumber(validation.stats.size),
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
