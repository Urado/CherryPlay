import * as fs from 'fs/promises';
import * as path from 'path';

import { logger } from './logger.js';

// Supported audio file extensions
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'] as const;

/**
 * Check if a file is an audio file based on its extension
 */
export function isAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Copy file with retry mechanism
 */
export async function copyFileWithRetry(
  src: string,
  dest: string,
  maxRetries: number = 3,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(dest);
      await ensureFolder(destDir);

      // Copy file
      await fs.copyFile(src, dest);
      return; // Success
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  throw lastError || new Error('Copy failed after retries');
}

/**
 * Ensure folder exists, create if it doesn't
 */
export async function ensureFolder(folderPath: string): Promise<void> {
  try {
    await fs.access(folderPath);
  } catch {
    // Folder doesn't exist, create it recursively
    await fs.mkdir(folderPath, { recursive: true });
  }
}

/**
 * Sanitize filename by removing problematic characters
 */
export function safeFileName(fileName: string): string {
  // Remove or replace problematic characters
  // Windows: < > : " | ? * \
  // Also remove control characters
  return (
    fileName
      .replace(/[<>:"|?*\\]/g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
      .trim()
  );
}

/** Windows: reserved device / DOS names, case-insensitive (folder segment). */
const WIN32_RESERVED_DIR_NAMES = new Set(
  [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ].map((s) => s.toUpperCase()),
);

/**
 * For portable project packages the output folder name must match the project name exactly.
 * Rejects names that need sanitization, path separators, or (on Windows) reserved / trailing rules.
 * @throws Error with user-facing RU message when invalid
 */
export function assertExactPortableProjectFolderName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Пустое название проекта — укажите имя, которое подойдёт для папки на диске');
  }
  if (trimmed !== name) {
    throw new Error('Название проекта не должно иметь лишние пробелы по краям');
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(
      'В названии проекта не должно быть символов пути. Измените название и повторите попытку.',
    );
  }
  if (safeFileName(name) !== name) {
    throw new Error(
      'В названии проекта есть символы, нельзя использовать в имени папки (например < > : " | ? * \\). ' +
        'Измените название так, как должна называться папка на диске, и повторите попытку.',
    );
  }
  if (process.platform === 'win32') {
    if (/[. ]$/.test(name)) {
      throw new Error(
        'В Windows имя папки не может заканчиваться точкой или пробелом. Измените название проекта.',
      );
    }
    if (WIN32_RESERVED_DIR_NAMES.has(name.toUpperCase())) {
      throw new Error(
        'Это имя зарезервировано в Windows для устройств. Задайте другое название проекта.',
      );
    }
  }
}

/**
 * Get relative path from one file/folder to another
 * Returns path using forward slashes (M3U standard)
 */
/**
 * True when `absolutePath` resolves to a location under `projectDir` (same
 * drive / root), so it is a normal project-scoped file. Used for strict
 * portable policy: a relative `srcPath` with `..` is allowed only if the
 * resulting path either stays inside the project, or (when outside) the file
 * exists and passes a strict `fs.access` check in the portable copy step.
 */
export function isResolvedPathUnderProjectDir(projectDir: string, absolutePath: string): boolean {
  const resolvedBase = path.resolve(projectDir);
  const resolved = path.resolve(absolutePath);
  const rel = path.relative(resolvedBase, resolved);
  if (rel === '') {
    return true;
  }
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }
  return true;
}

/**
 * Resolves a track path for portable copy and whether it escapes the project
 * directory (e.g. `../media/a.flac` or an absolute path on another drive).
 */
export function getPortableTrackSourceResolutionMeta(
  projectDir: string,
  srcPath: string,
): { absolute: string; outsideProjectDir: boolean } {
  const absolute = resolveTrackSourceForPortableCopy(projectDir, srcPath);
  return { absolute, outsideProjectDir: !isResolvedPathUnderProjectDir(projectDir, absolute) };
}

/**
 * Resolve a track file path for portable copy: absolute paths stay normalized;
 * relative paths (including `./` and `../` segments) are resolved against the
 * directory of the .cherry file, not the process cwd.
 */
export function resolveTrackSourceForPortableCopy(projectDir: string, srcPath: string): string {
  if (path.isAbsolute(srcPath)) {
    return path.resolve(srcPath);
  }
  return path.resolve(projectDir, srcPath);
}

export function getRelativePath(from: string, to: string): string {
  // Normalize paths
  const fromNormalized = path.resolve(from);
  const toNormalized = path.resolve(to);

  // Get relative path
  const relative = path.relative(path.dirname(fromNormalized), toNormalized);

  // Convert to forward slashes (M3U standard)
  return relative.replace(/\\/g, '/');
}

/**
 * Validate path to prevent path traversal attacks
 * @param userPath - Path provided by user
 * @param basePath - Optional base path to restrict access to
 * @returns true if path is valid, false otherwise
 */
export function validatePath(userPath: string, basePath?: string): boolean {
  if (!userPath || typeof userPath !== 'string') {
    return false;
  }

  try {
    // Block path traversal attempts (.. as path component) if basePath is not specified
    // This prevents path traversal attacks when no base path restriction is provided
    // Note: We allow ~ in filenames (valid on Windows and Unix)
    // Only ~ at the start of a path (like ~/file) is special on Unix, but path.resolve() handles it correctly
    // Check for .. as a path component (not just in filename), e.g., /../, \..\, ../, ..\
    if (!basePath) {
      // Check for .. as a separate path component (both forward and backslashes)
      const hasPathTraversal =
        userPath.includes('/../') ||
        userPath.includes('\\..\\') ||
        userPath.includes('\\../') ||
        userPath.includes('/..\\') ||
        userPath.startsWith('../') ||
        userPath.startsWith('..\\') ||
        userPath.endsWith('/..') ||
        userPath.endsWith('\\..') ||
        userPath === '..';
      if (hasPathTraversal) {
        return false;
      }
    }

    // Resolve and normalize the path
    const resolvedPath = path.resolve(userPath);

    // If basePath is provided, ensure resolved path is within it
    if (basePath) {
      const resolvedBasePath = path.resolve(basePath);

      // Check if resolved path starts with resolved base path
      // Use path.relative to check if path is within base
      const relative = path.relative(resolvedBasePath, resolvedPath);

      // If relative path starts with .. or is absolute, it's outside basePath
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    // Log errors for debugging in development mode
    logger.error('Path validation error', error);
    // If path resolution fails, it's invalid
    return false;
  }
}
