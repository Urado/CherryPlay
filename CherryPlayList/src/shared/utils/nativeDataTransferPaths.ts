import { getPlatform, isPlatformInitialized } from '../platform/platformContext';

import { normalizeFileBrowserPath } from './fileBrowserNavigationHistory';
import { logger } from './logger';

export type FileWithNativePath = File & { path?: string };

const getLegacyFilePath = (file: File): string | undefined => {
  const path = (file as FileWithNativePath).path;
  return typeof path === 'string' && path.length > 0 ? path : undefined;
};

export const isOsNativeFileDataTransfer = (
  dataTransfer: DataTransfer | null | undefined,
): boolean => {
  if (!dataTransfer?.files) {
    return false;
  }
  return dataTransfer.files.length > 0;
}

const getPathForFileSafe = (
  file: File,
  getPathForFile: (f: File) => string | undefined,
): string | undefined => {
  try {
    const p = getPathForFile(file);
    if (typeof p === 'string' && p.length > 0) {
      return normalizeFileBrowserPath(p);
    }
  } catch {
    return normalizeFileBrowserPath(getLegacyFilePath(file) ?? '') || undefined;
  }
  const legacy = getLegacyFilePath(file);
  if (legacy !== undefined) {
    return normalizeFileBrowserPath(legacy);
  }
  return undefined;
}

export const collectNativePathsFromDataTransfer = (
  dataTransfer: DataTransfer,
  getPathForFile: (f: File) => string | undefined,
): string[] => {
  if (!dataTransfer.files?.length) {
    return [];
  }

  const out: string[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (!file) {
      continue;
    }
    const p = getPathForFileSafe(file, getPathForFile);
    if (p) {
      out.push(p);
    }
  }
  return dedupePathOrder(out);
}

const dedupePathOrder = (paths: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of paths) {
    if (seen.has(p)) {
      continue;
    }
    seen.add(p);
    result.push(p);
  }
  return result;
}

export type PathStat = { isDirectory: boolean };

export type ClassifyNativePathsResult = {
  files: string[];
  directories: string[];
  inputCount: number;
  statFailureCount: number;
};

export const classifyNativePathsWithStat = async (
  absolutePaths: string[],
  statPath: (path: string) => Promise<PathStat>,
): Promise<ClassifyNativePathsResult> => {
  const files: string[] = [];
  const directories: string[] = [];
  let statFailureCount = 0;

  for (const p of absolutePaths) {
    try {
      const st = await statPath(p);
      if (st.isDirectory) {
        directories.push(p);
      } else {
        files.push(p);
      }
    } catch {
      statFailureCount += 1;
    }
  }

  if (statFailureCount > 0) {
    logger.info('classifyNativePathsWithStat: stat failures', {
      inputCount: absolutePaths.length,
      statFailureCount,
      filesCount: files.length,
      directoriesCount: directories.length,
    });
  }

  return {
    files,
    directories,
    inputCount: absolutePaths.length,
    statFailureCount,
  };
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export const tryParseInternalFileBrowserPayload = (
  dataTransfer: DataTransfer,
): { files: string[]; directories: string[] } | null => {
  const types = dataTransfer.types ? Array.from(dataTransfer.types) : [];
  if (!types.includes('application/json')) {
    return null;
  }
  const raw = dataTransfer.getData('application/json');
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return null;
    }
    const t = (parsed).type;
    if (t === 'fileBrowser') {
      const o = parsed as { paths?: unknown; directories?: unknown };
      return {
        files: toStringArray(o.paths),
        directories: toStringArray(o.directories),
      };
    }
    if (t === 'files') {
      const o = parsed as { paths?: unknown };
      if (Array.isArray(o.paths)) {
        return { files: toStringArray(o.paths), directories: [] };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export const getPathForFileInRenderer = (file: File): string | undefined => {
  if (isPlatformInitialized()) {
    try {
      return getPlatform().getPathForFile(file);
    } catch {
      return getLegacyFilePath(file);
    }
  }
  const legacy = getLegacyFilePath(file);
  if (legacy !== undefined) {
    return legacy;
  }
  return undefined;
}
