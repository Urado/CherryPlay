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

/**
 * Get relative path from one file/folder to another
 * Returns path using forward slashes (M3U standard)
 */
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
