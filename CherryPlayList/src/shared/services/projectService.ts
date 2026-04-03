import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  isProjectGroup,
  isProjectTrack,
  LinkedParty,
  PartyTrackDisplaySettings,
  ProjectFile,
  ProjectGroup,
  ProjectGroupSettings,
  ProjectItem,
  ProjectSessionState,
  ProjectSettings,
  ProjectTrackSettings,
  SavedProjectGroup,
  SavedProjectItem,
  SavedProjectTrack,
} from '@core/types/project';
import { Track } from '@core/types/track';
import { validateProjectFile, validateProjectIntegrity } from '@shared/utils/projectValidation';

import { ipcService } from './ipcService';

/**
 * Returns the directory portion of a file path (cross-platform, handles both / and \).
 */
function pathDirname(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : '.';
}

/**
 * Resolves a relative path against a base directory.
 * Handles `./` and `../` segments without requiring Node.js `path` module.
 */
function resolveRelativePath(baseDir: string, relativePath: string): string {
  // Normalize separators to forward slash for processing
  const normalizedBase = baseDir.replace(/\\/g, '/');
  const normalizedRel = relativePath.replace(/\\/g, '/');

  const parts = normalizedBase.split('/');

  // Remove trailing empty segment if base ends with /
  if (parts[parts.length - 1] === '') {
    parts.pop();
  }

  const relParts = normalizedRel.split('/');
  for (const segment of relParts) {
    if (segment === '.' || segment === '') {
      continue;
    } else if (segment === '..') {
      if (parts.length > 0) {
        parts.pop();
      }
    } else {
      parts.push(segment);
    }
  }

  const resolved = parts.join('/');

  // Restore Windows drive letter separator if present (e.g. "C:/..." → "C:/...")
  // and convert back to backslashes on Windows paths
  if (/^[A-Za-z]:/.test(resolved)) {
    return resolved.replace(/\//g, '\\');
  }

  return resolved;
}

/**
 * Returns true if the given path is relative (starts with ./ or ../).
 */
function isRelativePath(filePath: string): boolean {
  return (
    filePath.startsWith('./') ||
    filePath.startsWith('../') ||
    filePath.startsWith('.\\') ||
    filePath.startsWith('..\\')
  );
}

/**
 * Checks whether a file is accessible on disk.
 * Returns false instead of throwing if the file does not exist.
 */
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await ipcService.statFile(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves relative track paths to absolute and marks missing tracks.
 * Mutates tracks in-place; operates on all tracks recursively.
 */
async function resolveAndCheckTracks(items: ProjectItem[], cherryFilePath: string): Promise<void> {
  const baseDir = pathDirname(cherryFilePath);

  const processItems = async (projectItems: ProjectItem[]): Promise<void> => {
    for (const item of projectItems) {
      if (isProjectTrack(item)) {
        if (isRelativePath(item.path)) {
          item.path = resolveRelativePath(baseDir, item.path);
        }

        const exists = await checkFileExists(item.path);
        if (!exists) {
          item.isMissing = true;
        }
      } else if (isProjectGroup(item)) {
        await processItems(item.items);
      }
    }
  };

  await processItems(items);
}

/**
 * Состояние проекта для сериализации/десериализации
 */
export interface ProjectStateData {
  name: string;
  items: ProjectItem[];
  settings: ProjectSettings;
  trackSettings: Map<string, ProjectTrackSettings>;
  groupSettings: Map<string, ProjectGroupSettings>;
  sessionState?: ProjectSessionState;
  linkedParty?: LinkedParty | null;
  partyTrackDisplay?: PartyTrackDisplaySettings;
}

class ProjectService {
  /**
   * Сохранить проект в файл .cherry
   */
  async saveProject(
    path: string,
    projectFile: ProjectFile,
    options?: { portableMode?: boolean },
  ): Promise<void> {
    await ipcService.invoke<void>('project:save', {
      path,
      projectFile,
      portableMode: options?.portableMode,
    });
  }

  /**
   * Загрузить проект из файла .cherry
   * Валидирует данные и выводит предупреждения в консоль
   */
  async loadProject(filePath: string): Promise<ProjectStateData> {
    const rawData = await ipcService.invoke<unknown>('project:load', { path: filePath });

    // Валидируем загруженные данные
    const validationResult = validateProjectFile(rawData);

    if (!validationResult.isValid || !validationResult.data) {
      const errorMessage = validationResult.errors.join('; ');
      throw new Error(`Invalid project file: ${errorMessage}`);
    }

    // Выводим предупреждения в консоль
    if (validationResult.warnings.length > 0) {
      console.warn('Project file warnings:', validationResult.warnings);
    }

    // Проверяем целостность ссылок
    const integrityWarnings = validateProjectIntegrity(validationResult.data);
    if (integrityWarnings.length > 0) {
      console.warn('Project integrity warnings:', integrityWarnings);
    }

    const projectData = this.deserializeProject(validationResult.data);

    // Resolve relative paths to absolute and detect missing tracks
    if (filePath) {
      await resolveAndCheckTracks(projectData.items, filePath);
    }

    return projectData;
  }

  /**
   * Сериализация состояния проекта в формат файла .cherry
   */
  serializeProject(state: ProjectStateData): ProjectFile {
    const savedItems: SavedProjectItem[] = [];
    const rootItemIds: string[] = [];

    // Рекурсивно собираем все элементы
    const processItems = (items: ProjectItem[]): void => {
      items.forEach((item) => {
        if (isProjectTrack(item)) {
          const savedTrack: SavedProjectTrack = {
            type: 'track',
            id: item.id,
            path: item.path,
            name: item.name,
            duration: item.duration,
          };
          savedItems.push(savedTrack);
        } else if (isProjectGroup(item)) {
          // Сначала обрабатываем вложенные элементы
          processItems(item.items);

          const savedGroup: SavedProjectGroup = {
            type: 'group',
            id: item.id,
            name: item.name,
            items: item.items.map((child) => child.id),
          };
          savedItems.push(savedGroup);
        }
      });
    };

    // Обрабатываем все элементы
    processItems(state.items);

    // Собираем ID корневых элементов
    state.items.forEach((item) => {
      rootItemIds.push(item.id);
    });

    // Конвертируем Map в Record
    const trackSettingsRecord: Record<string, ProjectTrackSettings> = {};
    state.trackSettings.forEach((value, key) => {
      trackSettingsRecord[key] = value;
    });

    const groupSettingsRecord: Record<string, ProjectGroupSettings> = {};
    state.groupSettings.forEach((value, key) => {
      groupSettingsRecord[key] = value;
    });

    return {
      version: '2.0',
      name: state.name,
      items: savedItems,
      rootItems: rootItemIds,
      settings: state.settings,
      trackSettings: trackSettingsRecord,
      groupSettings: groupSettingsRecord,
      sessionState: state.sessionState,
      ...(state.linkedParty && { linkedParty: state.linkedParty }),
      partyTrackDisplay: state.partyTrackDisplay ?? DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
    };
  }

  /**
   * Десериализация файла .cherry в состояние проекта
   */
  deserializeProject(file: ProjectFile): ProjectStateData {
    // Создаем Map для быстрого доступа к элементам по ID
    const itemsById = new Map<string, SavedProjectItem>();
    file.items.forEach((item) => {
      itemsById.set(item.id, item);
    });

    // Рекурсивная функция для восстановления элемента
    const restoreItem = (itemId: string, visited: Set<string>): ProjectItem | null => {
      if (visited.has(itemId)) {
        console.warn(`Circular reference detected for item ${itemId}`);
        return null;
      }
      visited.add(itemId);

      const savedItem = itemsById.get(itemId);
      if (!savedItem) {
        console.warn(`Item ${itemId} not found`);
        return null;
      }

      if (savedItem.type === 'track') {
        const track: Track = {
          id: savedItem.id,
          path: savedItem.path,
          name: savedItem.name,
          duration: savedItem.duration,
        };
        return track;
      } else if (savedItem.type === 'group') {
        const children: ProjectItem[] = [];
        savedItem.items.forEach((childId) => {
          const child = restoreItem(childId, new Set(visited));
          if (child) {
            children.push(child);
          }
        });

        const group: ProjectGroup = {
          id: savedItem.id,
          name: savedItem.name,
          items: children,
        };
        return group;
      }

      return null;
    };

    // Восстанавливаем корневые элементы
    const items: ProjectItem[] = [];
    file.rootItems.forEach((itemId) => {
      const item = restoreItem(itemId, new Set());
      if (item) {
        items.push(item);
      }
    });

    // Конвертируем Record в Map
    const trackSettings = new Map<string, ProjectTrackSettings>();
    if (file.trackSettings) {
      Object.entries(file.trackSettings).forEach(([key, value]) => {
        trackSettings.set(key, value);
      });
    }

    const groupSettings = new Map<string, ProjectGroupSettings>();
    if (file.groupSettings) {
      Object.entries(file.groupSettings).forEach(([key, value]) => {
        groupSettings.set(key, value);
      });
    }

    return {
      name: file.name,
      items,
      settings: file.settings,
      trackSettings,
      groupSettings,
      sessionState: file.sessionState,
      linkedParty: file.linkedParty ?? null,
      partyTrackDisplay: file.partyTrackDisplay ?? DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
    };
  }
}

export const projectService = new ProjectService();
