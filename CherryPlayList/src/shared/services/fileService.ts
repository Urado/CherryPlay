import { ipcService, DirectoryItem } from './ipcService';

/**
 * Supported audio file extensions
 */
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'] as const;

/**
 * Get file extension from path (browser-safe)
 */
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastDot > lastSlash && lastDot !== -1) {
    return filePath.substring(lastDot).toLowerCase();
  }
  return '';
}

/**
 * Get parent directory path (browser-safe)
 */
function getParentPath(filePath: string): string | null {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');

  if (lastSlash === -1) {
    return null; // No parent (root)
  }

  if (lastSlash === 0) {
    // Root path like "/folder"
    return '/';
  }

  const parent = normalized.substring(0, lastSlash);

  // If parent is the same as current, we're at root
  if (parent === filePath) {
    return null;
  }

  return parent;
}

class FileService {
  /**
   * List folder contents
   */
  async listFolder(folderPath: string): Promise<DirectoryItem[]> {
    // ipcService.invoke уже обрабатывает ошибки и показывает уведомления
    return await ipcService.listDirectory(folderPath);
  }

  /**
   * Check if file is a valid audio file
   */
  isValidAudioFile(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
  }

  /**
   * Read file metadata (optional, for future use)
   */
  async readFileMeta(filePath: string): Promise<{
    size: number;
    modified: number;
    isDirectory: boolean;
  } | null> {
    try {
      // ipcService.invoke уже обрабатывает ошибки и показывает уведомления
      return await ipcService.statFile(filePath);
    } catch {
      // Возвращаем null при ошибке, так как это не критичная операция
      return null;
    }
  }

  /**
   * Get parent path
   */
  getParentPath(filePath: string): string | null {
    return getParentPath(filePath);
  }

  /**
   * Get path segments for breadcrumbs (cross-platform)
   * Handles both Windows (C:\Users\...) and Unix (/home/...) paths
   */
  getPathSegments(filePath: string): Array<{ name: string; path: string }> {
    if (!filePath) return [];

    const crumbs: Array<{ name: string; path: string }> = [];

    // Normalize path separators to forward slashes for processing
    const normalized = filePath.replace(/\\/g, '/');

    // Handle Windows absolute paths (C:/Users/...)
    // eslint-disable-next-line security/detect-unsafe-regex
    const windowsDriveMatch = normalized.match(/^([A-Za-z]:)(\/.*)?$/);
    if (windowsDriveMatch) {
      const drive = windowsDriveMatch[1];
      const rest = windowsDriveMatch[2] || '';

      // Add drive as first segment
      crumbs.push({ name: drive, path: drive + '/' });

      // Process rest of the path
      const parts = rest.split('/').filter((p) => p);
      let currentPath = drive + '/';

      for (const part of parts) {
        currentPath =
          currentPath === drive + '/' ? `${currentPath}${part}` : `${currentPath}/${part}`;
        crumbs.push({ name: part, path: currentPath });
      }

      return crumbs;
    }

    // Handle Unix absolute paths (/home/...)
    if (normalized.startsWith('/')) {
      const parts = normalized.split('/').filter((p) => p);
      let currentPath = '/';

      // Add root
      crumbs.push({ name: '/', path: '/' });

      for (const part of parts) {
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
        crumbs.push({ name: part, path: currentPath });
      }

      return crumbs;
    }

    // Handle relative paths
    const parts = normalized.split('/').filter((p) => p);
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      crumbs.push({ name: part, path: currentPath });
    }

    return crumbs;
  }
}

export const fileService = new FileService();
