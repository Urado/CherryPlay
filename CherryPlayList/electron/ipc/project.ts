import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';

import { copyFileWithRetry, ensureFolder, validatePath } from '../utils/fsHelpers.js';

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
 * Resolve a unique destination filename in the tracks folder.
 * If `tracks/filename.ext` already exists and is a different source file,
 * appends `_2`, `_3`, etc. until a free slot is found.
 */
async function resolveUniqueDestPath(tracksDir: string, srcPath: string): Promise<string> {
  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext);
  let candidate = path.join(tracksDir, `${baseName}${ext}`);

  // If the candidate is the same file as the source, no conflict
  if (path.resolve(candidate) === path.resolve(srcPath)) {
    return candidate;
  }

  let suffix = 2;
  while (true) {
    try {
      await fs.access(candidate);
      // Different file occupies this name — try next suffix
      candidate = path.join(tracksDir, `${baseName}_${suffix}${ext}`);
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
): Promise<void> {
  const projectDir = path.dirname(filePath);
  const tracksDir = path.join(projectDir, 'tracks');

  await ensureFolder(tracksDir);

  const trackItems = projectFile.items.filter((item) => item.type === 'track' && item.path);
  const total = trackItems.length;

  if (total === 0) {
    sendProgress(0, 0, '');
    return;
  }

  for (let i = 0; i < trackItems.length; i++) {
    const item = trackItems[i];
    const srcPath = item.path!;
    const fileName = path.basename(srcPath);

    // Use path.resolve for reliable cross-platform comparison (handles relative paths and case)
    const srcDir = path.resolve(path.dirname(srcPath));
    const normalizedTracksDir = path.resolve(tracksDir);

    if (srcDir === normalizedTracksDir) {
      // Already in tracks/ — just rewrite path to relative form
      item.path = `./tracks/${fileName}`;
      sendProgress(i + 1, total, fileName);
      continue;
    }

    // Check source accessibility; skip (don't fail) if missing
    try {
      await fs.access(srcPath);
    } catch {
      sendProgress(i + 1, total, fileName);
      continue;
    }

    const destPath = await resolveUniqueDestPath(tracksDir, srcPath);
    const destFileName = path.basename(destPath);

    await copyFileWithRetry(srcPath, destPath);

    // Use forward slashes for the relative path stored on disk
    item.path = `./tracks/${destFileName}`;

    sendProgress(i + 1, total, fileName);
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
