import { ipcService, DirectoryItem } from './ipcService';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'] as const;

const getFileExtension = (filePath: string): string => {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastDot > lastSlash && lastDot !== -1) {
    return filePath.substring(lastDot).toLowerCase();
  }
  return '';
};

const getParentPath = (filePath: string): string | null => {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');

  if (lastSlash === -1) {
    return null;
  }

  if (lastSlash === 0) {
    return '/';
  }

  const parent = normalized.substring(0, lastSlash);

  if (parent === filePath) {
    return null;
  }

  return parent;
};

class FileService {
  async listFolder(folderPath: string): Promise<DirectoryItem[]> {
    return await ipcService.listDirectory(folderPath);
  }

  isValidAudioFile(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
  }

  isListableInFileBrowser(item: { path: string; isDirectory: boolean }): boolean {
    return item.isDirectory || this.isValidAudioFile(item.path);
  }

  async readFileMeta(filePath: string): Promise<{
    size: number;
    modified: number;
    isDirectory: boolean;
  } | null> {
    try {
      return await ipcService.statFile(filePath);
    } catch {
      return null;
    }
  }

  getParentPath(filePath: string): string | null {
    return getParentPath(filePath);
  }

  getPathSegments(filePath: string): Array<{ name: string; path: string }> {
    if (!filePath) return [];

    const crumbs: Array<{ name: string; path: string }> = [];

    const normalized = filePath.replace(/\\/g, '/');

    const firstCharacterCode = normalized.charCodeAt(0);
    const hasWindowsDrive =
      ((firstCharacterCode >= 65 && firstCharacterCode <= 90) ||
        (firstCharacterCode >= 97 && firstCharacterCode <= 122)) &&
      normalized[1] === ':';
    const rest = normalized.slice(2);
    if (hasWindowsDrive && (rest === '' || rest.startsWith('/'))) {
      const drive = normalized.slice(0, 2);

      crumbs.push({ name: drive, path: drive + '/' });

      const parts = rest.split('/').filter((p) => p);
      let currentPath = drive + '/';

      for (const part of parts) {
        currentPath =
          currentPath === drive + '/' ? `${currentPath}${part}` : `${currentPath}/${part}`;
        crumbs.push({ name: part, path: currentPath });
      }

      return crumbs;
    }

    if (normalized.startsWith('/')) {
      const parts = normalized.split('/').filter((p) => p);
      let currentPath = '/';

      crumbs.push({ name: '/', path: '/' });

      for (const part of parts) {
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
        crumbs.push({ name: part, path: currentPath });
      }

      return crumbs;
    }

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
