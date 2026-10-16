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

const buildTrackCollectionFolderMap = (projectFile: ProjectFile): Map<string, string | null> => {
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
};

const resolveUniqueDestPath = async (destDir: string, srcPath: string): Promise<string> => {
  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext);
  let candidate = path.join(destDir, `${baseName}${ext}`);

  if (path.resolve(candidate) === path.resolve(srcPath)) {
    return candidate;
  }

  let suffix = 2;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(destDir, `${baseName}_${suffix}${ext}`);
      suffix++;
    } catch {
      return candidate;
    }
  }
};

const copyTracksForPortableMode = async (
  filePath: string,
  projectFile: ProjectFile,
  sendProgress: (current: number, total: number, fileName: string) => void,
  options?: { strictSourceFiles?: boolean },
): Promise<void> => {
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
          try {
            await fs.access(srcAbsolute);
          } catch {
            throw new Error(
              'Переносимое сохранение: в ./tracks/ указан путь, но файл на диске не найден или недоступен. ' +
                `Трек: «${trackLabel}» — ${fileName} (${srcAbsolute})`,
            );
          }
        }
        const relativeFromTracks = path.relative(tracksDir, srcAbsolute);
        const normalizedRelative = relativeFromTracks.split(path.sep).join('/');
        item.path = `./tracks/${normalizedRelative}`;
        sendProgress(i + 1, total, fileName);
        continue;
      }

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
};

const saveProject = async (filePath: string, projectFile: ProjectFile): Promise<void> => {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, JSON.stringify(projectFile, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save project: ${(error as Error).message}`);
  }
};

const loadProject = async (filePath: string): Promise<ProjectFile> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const projectFile = JSON.parse(content) as ProjectFile;

    const projectVersion = String(projectFile.version);
    if (projectVersion !== '2.0') {
      throw new Error(`Unsupported project version: ${projectVersion}`);
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
};

const savePortableProjectAsPackage = async (
  event: IpcMainInvokeEvent,
  parentPath: string,
  projectFile: ProjectFile,
): Promise<{ cherryPath: string; folderPath: string }> => {
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
  const portableFile = JSON.parse(JSON.stringify(projectFile)) as ProjectFile;

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
      }
      throw renameError;
    }
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  return {
    folderPath: finalDir,
    cherryPath: path.join(finalDir, cherryFileName),
  };
};

export const registerProjectHandlers = (): void => {
  ipcMain.handle(
    'project:save',
    async (
      event,
      payload: {
        path: string;
        projectFile: ProjectFile;
        portableMode?: boolean;
        strictSourceFiles?: boolean;
      },
    ) => {
      try {
        if (!validatePath(payload.path)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }

        if (payload.portableMode) {
          const portableFile = JSON.parse(JSON.stringify(payload.projectFile)) as ProjectFile;

          await copyTracksForPortableMode(
            payload.path,
            portableFile,
            (current, total, fileName) => {
              event.sender.send('project:save-progress', { current, total, fileName });
            },
            { strictSourceFiles: true },
          );

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
};
