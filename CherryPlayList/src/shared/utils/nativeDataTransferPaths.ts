import { getPlatform, isPlatformInitialized } from '../platform/platformContext';

import { normalizeFileBrowserPath } from './fileBrowserNavigationHistory';
import { logger } from './logger';

/** File with optional absolute path (Chromium / Electron). */
export type FileWithNativePath = File & { path?: string };

/**
 * Returns true when the drag carries OS file entries (e.g. Explorer on Windows).
 * Internal FileBrowser drags only set `application/json` and typically have an empty `files` list.
 */
export function isOsNativeFileDataTransfer(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer?.files) {
    return false;
  }
  return dataTransfer.files.length > 0;
}

function getPathForFileSafe(
  file: File,
  getPathForFile: (f: File) => string | undefined,
): string | undefined {
  try {
    const p = getPathForFile(file);
    if (typeof p === 'string' && p.length > 0) {
      return normalizeFileBrowserPath(p);
    }
  } catch {
    // webUtils.getPathForFile throws for non-path-backed files (e.g. blob:)
  }
  const legacy = (file as FileWithNativePath).path;
  if (typeof legacy === 'string' && legacy.length > 0) {
    return normalizeFileBrowserPath(legacy);
  }
  return undefined;
}

/**
 * Collects absolute paths from `DataTransfer.files` (Explorer / OS drops).
 * Prefer `getPlatform().getPathForFile` (Electron `webUtils.getPathForFile` via preload).
 */
export function collectNativePathsFromDataTransfer(
  dataTransfer: DataTransfer,
  getPathForFile: (f: File) => string | undefined,
): string[] {
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

function dedupePathOrder(paths: string[]): string[] {
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

/** Result of classifying native paths; includes counts for observability and error surfacing. */
export type ClassifyNativePathsResult = {
  files: string[];
  directories: string[];
  inputCount: number;
  statFailureCount: number;
};

/**
 * Splits raw paths into files vs directories using an async stat (e.g. `fileBrowser:statFile` IPC).
 * Failed stats are counted, logged in development (`logger.info`), and returned in `statFailureCount`.
 */
export async function classifyNativePathsWithStat(
  absolutePaths: string[],
  statPath: (path: string) => Promise<PathStat>,
): Promise<ClassifyNativePathsResult> {
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

/**
 * When `application/json` carries FileBrowser drag data (`fileBrowser` or legacy `files`),
 * that payload is authoritative for drop handling vs OS `DataTransfer.files` (Explorer).
 * Returns `null` if there is no JSON, parse error, or unrecognized `type`.
 */
export function tryParseInternalFileBrowserPayload(
  dataTransfer: DataTransfer,
): { files: string[]; directories: string[] } | null {
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
    const t = (parsed as { type: unknown }).type;
    if (t === 'fileBrowser') {
      const o = parsed as { paths?: unknown; directories?: unknown };
      return {
        files: Array.isArray(o.paths) ? o.paths : [],
        directories: Array.isArray(o.directories) ? o.directories : [],
      };
    }
    if (t === 'files') {
      const o = parsed as { paths?: unknown };
      if (Array.isArray(o.paths)) {
        return { files: o.paths, directories: [] };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolves a native path for a dropped `File` in the renderer (Electron preload or legacy `.path`).
 */
export function getPathForFileInRenderer(file: File): string | undefined {
  if (isPlatformInitialized()) {
    try {
      return getPlatform().getPathForFile(file);
    } catch {
      // fall through to legacy .path
    }
  }
  const legacy = (file as FileWithNativePath).path;
  if (typeof legacy === 'string' && legacy.length > 0) {
    return legacy;
  }
  return undefined;
}
