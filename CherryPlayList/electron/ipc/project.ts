import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';

import { validatePath } from '../utils/fsHelpers.js';

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

        await saveProject(payload.path, payload.projectFile);
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
