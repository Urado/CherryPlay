import * as fs from 'fs/promises';
import * as path from 'path';

import { type IpcMainInvokeEvent, ipcMain } from 'electron';

import {
  assertExactPortableProjectFolderName,
  copyFileWithRetry,
  ensureFolder,
  isResolvedPathUnderProjectDir,
  resolveTrackSourceForPortableCopy,
  safeFileName,
  validatePath,
} from '../utils/fsHelpers.js';

/**
 * Формат файла .cherry (версия 2.0)
 */
export interface ProjectFile {
  version: '2.0';
  name: string;
  items: Array<{
    type: 'track' | 'group';
    id: string;
    path?: string;
    name: string;
    duration?: number;
    items?: string[];
  }>;
  rootItems: string[];
  settings: {
    defaultPauseBetweenTracks: number;
    defaultActionAfterTrack: string;
    plannedEndTime: number | null;
    portableMode?: boolean;
  };
  trackSettings: Record<
    string,
    {
      pauseBetweenTracks?: number | null;
      actionAfterTrack?: string | null;
    }
  >;
  groupSettings: Record<
    string,
    {
      pauseBetweenTracks?: number | null;
      actionAfterTrack?: string | null;
    }
  >;
  sessionState?: {
    mode: 'preparation' | 'session';
    playedTrackIds: string[];
    disabledTrackIds: string[];
    disabledGroupIds: string[];
    currentTrackId: string | null;
    sessionStartTime: number | null;
  };
  linkedParty?: { id: string; shortCode: string; url: string };
}

/**
 * Build a mapping from track ID to the path of groups (collections) it belongs to.
 * The path contains group names from root to the deepest group that contains the track.
 */
function buildTrackCollectionFolderMap(projectFile: ProjectFile): Map<string, string | null> {
  const itemsById = new Map<string, ProjectFile['items'][number]>();

  for (const item of projectFile.items) {
    itemsById.set(item.id, item);
  }

  const trackToGroupPath = new Map<string, string[]>();

  const visit = (itemId: string, groupPath: string[]): void => {
    const item = itemsById.get(itemId);
    if (!item) {
      return;
    }

    if (item.type === 'track') {
      // Only set the group path if we haven't seen this track yet.
      if (!trackToGroupPath.has(item.id)) {
        trackToGroupPath.set(item.id, groupPath);
      }
      return;
    }

    if (item.type === 'group' && Array.isArray(item.items)) {
      const nextPath = [...groupPath, item.name];
      for (const childId of item.items) {
        visit(childId, nextPath);
      }
    }
  };

  for (const rootId of projectFile.rootItems) {
    visit(rootId, []);
  }

  const result = new Map<string, string | null>();

  for (const [trackId, groupPath] of trackToGroupPath.entries()) {
    if (groupPath.length === 0) {
      result.set(trackId, null);
      continue;
    }

    const sanitizedSegments = groupPath.map((name, index) => {
      const base = name && name.trim().length > 0 ? name.trim() : `Group${index + 1}`;
      const sanitized = safeFileName(base);
      return sanitized.length === 0 ? `Group${index + 1}` : sanitized;
    });

    result.set(trackId, sanitizedSegments.join(path.sep));
  }

  return result;
}

/**
 * Resolve a unique destination filename in the tracks folder.
 * If `tracks/filename.ext` already exists and is a different source file,
 * appends `_2`, `_3`, etc. until a free slot is found.
 */
async function resolveUniqueDestPath(destDir: string, srcPath: string): Promise<string> {
  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext);
  let candidate = path.join(destDir, `${baseName}${ext}`);

  // If the candidate is the same file as the source, no conflict
  if (path.resolve(candidate) === path.resolve(srcPath)) {
    return candidate;
  }

  let suffix = 2;
  while (true) {
    try {
      await fs.access(candidate);
      // Different file occupies this name — try next suffix
      candidate = path.join(destDir, `${baseName}_${suffix}${ext}`);
      suffix++;
    } catch {
      // fs.access threw → file does not exist → slot is free
      return candidate;
    }
  }
}

/**
 * Copy all track files into `<projectDir>/tracks/` and rewrite their paths
 * to relative form (`./tracks/filename.ext`) in the projectFile in-place.
 * Emits `project:save-progress` events via `sendProgress`.
 */
async function copyTracksForPortableMode(
  filePath: string,
  projectFile: ProjectFile,
  sendProgress: (current: number, total: number, fileName: string) => void,
  options?: { strictSourceFiles?: boolean },
): Promise<void> {
  const strictSourceFiles = options?.strictSourceFiles === true;
  const projectDir = path.dirname(filePath);
  const tracksDir = path.join(projectDir, 'tracks');

  await ensureFolder(tracksDir);

  const allTrackItems = projectFile.items.filter((item) => item.type === 'track');
  if (strictSourceFiles) {
    for (const item of allTrackItems) {
      const src = item.path;
      if (src === undefined || src === null || String(src).trim() === '') {
        const label = item.name?.trim() ? String(item.name) : item.id;
        throw new Error(
          `Для переносимого сохранения у каждого трека нужен путь к файлу (трек «${label}»).`,
        );
      }
    }
  }

  const trackItems = projectFile.items.filter((item) => item.type === 'track' && item.path);
  const total = trackItems.length;
  const normalizedTracksDir = path.resolve(tracksDir);
  const isWindows = process.platform === 'win32';
  const trackCollectionFolders = buildTrackCollectionFolderMap(projectFile);

  if (total === 0) {
    sendProgress(0, 0, '');
  } else {
    for (let i = 0; i < trackItems.length; i++) {
      const item = trackItems[i];
      const rawSrcPath = item.path!;
      const trackLabel = item.name?.trim() ? String(item.name) : item.id;
      const srcAbsolute = resolveTrackSourceForPortableCopy(projectDir, rawSrcPath);
      const fileName = path.basename(srcAbsolute);
      const normalizedSrcAbsolute = isWindows ? srcAbsolute.toLowerCase() : srcAbsolute;
      const normalizedTracksRoot = isWindows
        ? normalizedTracksDir.toLowerCase()
        : normalizedTracksDir;
      const inTracksDir =
        normalizedSrcAbsolute === normalizedTracksRoot ||
        normalizedSrcAbsolute.startsWith(normalizedTracksRoot + path.sep);

      if (inTracksDir) {
        if (strictSourceFiles) {
          // Portable strict: do not rewrite ./tracks/... if the file is missing.
          try {
            await fs.access(srcAbsolute);
          } catch {
            throw new Error(
              'Переносимое сохранение: в ./tracks/ указан путь, но файл на диске не найден или недоступен. ' +
                `Трек: «${trackLabel}» — ${fileName} (${srcAbsolute})`,
            );
          }
        }
        // Already inside tracks/ (including subfolders) — rewrite path to relative form
        const relativeFromTracks = path.relative(tracksDir, srcAbsolute);
        const normalizedRelative = relativeFromTracks.split(path.sep).join('/');
        item.path = `./tracks/${normalizedRelative}`;
        sendProgress(i + 1, total, fileName);
        continue;
      }

      // Check source accessibility: strict (save-as «переносимый») — abort; legacy — skip.
      // Relative `..` that resolves outside the project is allowed in strict mode only if the file exists
      // (enforced by this access; otherwise a dedicated message explains the policy).
      try {
        await fs.access(srcAbsolute);
      } catch {
        if (strictSourceFiles) {
          if (!isResolvedPathUnderProjectDir(projectDir, srcAbsolute)) {
            throw new Error(
              'Переносимое сохранение: путь вне папки проекта (например, через `..`) должен указывать ' +
                'на существующий, доступный для чтения файл. ' +
                `Трек: «${trackLabel}» — ${fileName} (${srcAbsolute})`,
            );
          }
          throw new Error(`Нет доступа к файлу трека (прервано): ${fileName} — ${srcAbsolute}`);
        }
        sendProgress(i + 1, total, fileName);
        continue;
      }

      const collectionFolder = trackCollectionFolders.get(item.id) ?? null;
      const destBaseDir = collectionFolder ? path.join(tracksDir, collectionFolder) : tracksDir;
      const destPath = await resolveUniqueDestPath(destBaseDir, srcAbsolute);

      await copyFileWithRetry(srcAbsolute, destPath);

      // Use forward slashes for the relative path stored on disk
      const relativeFromTracks = path.relative(tracksDir, destPath);
      const normalizedRelative = relativeFromTracks.split(path.sep).join('/');
      item.path = `./tracks/${normalizedRelative}`;

      sendProgress(i + 1, total, fileName);
    }
  }

  const normalizePath = (p: string) => {
    const resolved = path.resolve(p);
    return isWindows ? resolved.toLowerCase() : resolved;
  };

  const usedTrackPaths = new Set<string>();

  for (const item of projectFile.items) {
    if (item.type !== 'track' || !item.path) {
      continue;
    }

    if (!item.path.startsWith('./tracks/')) {
      continue;
    }

    const absolutePath = path.resolve(projectDir, item.path);
    usedTrackPaths.add(normalizePath(absolutePath));
  }

  const stack: string[] = [tracksDir];

  while (stack.length > 0) {
    const currentDir = stack.pop()!;
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const normalizedEntryPath = normalizePath(entryPath);

      if (!usedTrackPaths.has(normalizedEntryPath)) {
        await fs.unlink(entryPath);
      }
    }
  }
}

/**
 * Save project to .cherry file
 */
async function saveProject(filePath: string, projectFile: ProjectFile): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write JSON file
    await fs.writeFile(filePath, JSON.stringify(projectFile, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save project: ${(error as Error).message}`);
  }
}

/**
 * Load project from .cherry file
 */
async function loadProject(filePath: string): Promise<ProjectFile> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const projectFile = JSON.parse(content) as ProjectFile;

    // Validate structure
    if (projectFile.version !== '2.0') {
      throw new Error(`Unsupported project version: ${projectFile.version}`);
    }

    if (
      !projectFile.name ||
      !Array.isArray(projectFile.items) ||
      !Array.isArray(projectFile.rootItems)
    ) {
      throw new Error('Invalid project format: missing required fields');
    }

    if (!projectFile.settings) {
      throw new Error('Invalid project format: missing settings');
    }

    return projectFile;
  } catch (error) {
    throw new Error(`Failed to load project: ${(error as Error).message}`);
  }
}

/**
 * Переносимый пакет: папка с именем проекта внутри parentPath, .cherry и tracks в staging; затем rename.
 * Любая ошибка — каталог staging удаляется, финальная папка не остаётся.
 */
async function savePortableProjectAsPackage(
  event: IpcMainInvokeEvent,
  parentPath: string,
  projectFile: ProjectFile,
): Promise<{ cherryPath: string; folderPath: string }> {
  if (!validatePath(parentPath)) {
    throw new Error('Invalid path: path traversal detected');
  }

  const rawName = (projectFile.name || 'project').trim() || 'project';
  assertExactPortableProjectFolderName(rawName);

  const finalDir = path.join(parentPath, rawName);
  if (!validatePath(finalDir) || !validatePath(finalDir, parentPath)) {
    throw new Error('Invalid project path');
  }

  let parentStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    parentStat = await fs.stat(parentPath);
  } catch {
    throw new Error('Не удалось открыть выбранную папку');
  }
  if (!parentStat.isDirectory()) {
    throw new Error('Указанный путь не является папкой');
  }

  let finalPathExists = false;
  try {
    await fs.access(finalDir);
    finalPathExists = true;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      finalPathExists = false;
    } else {
      throw new Error(
        `Не удалось проверить папку назначения: ${err?.message ?? (e as Error).message}`,
      );
    }
  }
  if (finalPathExists) {
    throw new Error('Папка с таким именем уже существует');
  }

  const stagingName = `.cherryportable-staging-${Date.now()}`;
  const stagingDir = path.join(parentPath, stagingName);
  if (!validatePath(stagingDir, parentPath)) {
    throw new Error('Invalid staging path');
  }

  const cherryFileName = `${rawName}.cherry`;
  const cherryPath = path.join(stagingDir, cherryFileName);
  const portableFile: ProjectFile = JSON.parse(JSON.stringify(projectFile));

  try {
    await copyTracksForPortableMode(
      cherryPath,
      portableFile,
      (current, total, fileName) => {
        event.sender.send('project:save-progress', { current, total, fileName });
      },
      { strictSourceFiles: true },
    );
    portableFile.settings.portableMode = true;
    await saveProject(cherryPath, portableFile);
    try {
      await fs.rename(stagingDir, finalDir);
    } catch (renameError) {
      const code = (renameError as NodeJS.ErrnoException).code;
      if (code === 'EEXIST' || code === 'ENOTEMPTY') {
        throw new Error('Папка с таким именем уже существует');
      }
      // TOCTOU: destination may have appeared after the initial existence check
      try {
        const st = await fs.stat(finalDir);
        if (st.isDirectory()) {
          throw new Error('Папка с таким именем уже существует');
        }
      } catch (statError) {
        if (
          statError instanceof Error &&
          statError.message === 'Папка с таким именем уже существует'
        ) {
          throw statError;
        }
        // finalDir missing or not the conflict — surface original rename error
      }
      throw renameError;
    }
  } catch (error) {
    try {
      await fs.rm(stagingDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    throw error;
  }

  return {
    folderPath: finalDir,
    cherryPath: path.join(finalDir, cherryFileName),
  };
}

/**
 * Register project IPC handlers
 */
export function registerProjectHandlers(): void {
  ipcMain.handle(
    'project:save',
    async (
      event,
      payload: {
        path: string;
        projectFile: ProjectFile;
        portableMode?: boolean;
        /** Ignored when `portableMode` is set — main always uses strict copy-all-or-abort for portable saves. */
        strictSourceFiles?: boolean;
      },
    ) => {
      try {
        // Validate path to prevent path traversal attacks
        if (!validatePath(payload.path)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }

        if (payload.portableMode) {
          // Deep-clone to avoid mutating the renderer's in-memory state
          const portableFile: ProjectFile = JSON.parse(JSON.stringify(payload.projectFile));

          await copyTracksForPortableMode(
            payload.path,
            portableFile,
            (current, total, fileName) => {
              event.sender.send('project:save-progress', { current, total, fileName });
            },
            { strictSourceFiles: true },
          );

          // Mark the file as portable so it reloads correctly
          portableFile.settings.portableMode = true;

          await saveProject(payload.path, portableFile);
        } else {
          await saveProject(payload.path, payload.projectFile);
        }

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle(
    'project:savePortableAs',
    async (
      event,
      payload: {
        parentPath: string;
        projectFile: ProjectFile;
      },
    ) => {
      try {
        if (!validatePath(payload.parentPath)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }
        if (!payload.projectFile) {
          return {
            success: false,
            error: 'Нет данных проекта',
          };
        }
        const data = await savePortableProjectAsPackage(
          event,
          payload.parentPath,
          payload.projectFile,
        );
        return {
          success: true,
          data,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle('project:load', async (event, payload: { path: string }) => {
    try {
      // Validate path to prevent path traversal attacks
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const projectFile = await loadProject(payload.path);
      return {
        success: true,
        data: projectFile,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
