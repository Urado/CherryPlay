import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  isProjectGroup,
  isProjectTrack,
  LinkedParty,
  PartyTrackDisplaySettings,
  ProjectFile,
  ProjectCollection,
  ProjectGroupSettings,
  ProjectItem,
  ProjectSessionState,
  ProjectSettings,
  ProjectTrackSettings,
  SavedProjectItem,
} from '@core/types/project';
import { validateProjectFile, validateProjectIntegrity } from '@shared/utils/projectValidation';

import { ipcService } from './ipcService';
import { normalizeLoadedLoudness } from './loudnessService';

const pathDirname = (filePath: string): string => {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : '.';
};

const resolveRelativePath = (baseDir: string, relativePath: string): string => {
  const normalizedBase = baseDir.replace(/\\/g, '/');
  const normalizedRel = relativePath.replace(/\\/g, '/');

  const parts = normalizedBase.split('/');

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

  if (/^[A-Za-z]:/.test(resolved)) {
    return resolved.replace(/\//g, '\\');
  }

  return resolved;
};

const isRelativePath = (filePath: string): boolean => {
  return (
    filePath.startsWith('./') ||
    filePath.startsWith('../') ||
    filePath.startsWith('.\\') ||
    filePath.startsWith('..\\')
  );
};

const checkFileExists = async (filePath: string): Promise<boolean> => {
  try {
    await ipcService.statFile(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveAndCheckTracks = async (
  items: ProjectItem[],
  cherryFilePath: string,
  options?: { portableCollectionName?: string },
): Promise<void> => {
  const baseDir = pathDirname(cherryFilePath);

  const processItems = async (projectItems: ProjectItem[]): Promise<void> => {
    for (const item of projectItems) {
      if (isProjectTrack(item)) {
        const relativePath = item.path;
        if (isRelativePath(item.path)) {
          item.path = resolveRelativePath(baseDir, item.path);
        }

        const exists = await checkFileExists(item.path);
        if (
          !exists &&
          options?.portableCollectionName &&
          relativePath.replace(/\\/g, '/').startsWith('./collections/')
        ) {
          throw new Error(
            `Не удалось открыть переносимый проект: файл трека подборки «${options.portableCollectionName}» не найден. Проверьте, что папка подборки не переименована и пакет не изменён.`,
          );
        }
        item.isMissing = !exists;
      } else if (isProjectGroup(item)) {
        await processItems(item.items);
      }
    }
  };

  await processItems(items);
};

export interface ProjectStateData {
  name: string;
  items: ProjectItem[];
  settings: ProjectSettings;
  trackSettings: Map<string, ProjectTrackSettings>;
  groupSettings: Map<string, ProjectGroupSettings>;
  sessionState?: ProjectSessionState;
  linkedParty?: LinkedParty | null;
  partyTrackDisplay?: PartyTrackDisplaySettings;
  partyThemeId?: string;
  partyCustomizationSettings?: Record<string, unknown>;
  collections?: ProjectCollection[];
  collectionViewState?: { bindings: Record<string, string> };
}

const serializeItems = (items: ProjectItem[]): { items: SavedProjectItem[]; rootItems: string[] } => {
  const savedItems: SavedProjectItem[] = [];
  const processItems = (projectItems: ProjectItem[]): void => {
    projectItems.forEach((item) => {
      if (isProjectTrack(item)) {
        savedItems.push({
          type: 'track',
          id: item.id,
          path: item.path,
          name: item.name,
          duration: item.duration,
          ...(item.loudness !== undefined ? { loudness: item.loudness } : {}),
        });
      } else if (isProjectGroup(item)) {
        processItems(item.items);
        savedItems.push({
          type: 'group',
          id: item.id,
          name: item.name,
          items: item.items.map((child) => child.id),
        });
      }
    });
  };
  processItems(items);
  return { items: savedItems, rootItems: items.map((item) => item.id) };
};

const deserializeItems = (savedItems: SavedProjectItem[], rootItems: string[]): ProjectItem[] => {
  const itemsById = new Map<string, SavedProjectItem>(savedItems.map((item) => [item.id, item]));
  const restoreItem = (itemId: string, visited: Set<string>): ProjectItem | null => {
    if (visited.has(itemId)) return null;
    visited.add(itemId);
    const savedItem = itemsById.get(itemId);
    if (!savedItem) return null;
    if (savedItem.type === 'track') {
      const normalizedLoudness = savedItem.loudness !== undefined
        ? normalizeLoadedLoudness(savedItem.loudness)
        : undefined;
      return {
        id: savedItem.id,
        path: savedItem.path,
        name: savedItem.name,
        duration: savedItem.duration,
        ...(normalizedLoudness !== undefined ? { loudness: normalizedLoudness } : {}),
      };
    }
    return {
      id: savedItem.id,
      name: savedItem.name,
      items: savedItem.items.flatMap((childId) => {
        const child = restoreItem(childId, new Set(visited));
        return child ? [child] : [];
      }),
    };
  };
  return rootItems.flatMap((itemId) => {
    const item = restoreItem(itemId, new Set());
    return item ? [item] : [];
  });
};

class ProjectService {
  async saveProject(
    path: string,
    projectFile: ProjectFile,
    options?: { portableMode?: boolean; strictSourceFiles?: boolean; notifyOnIpcError?: boolean },
  ): Promise<void> {
    const notify = options?.notifyOnIpcError !== false;
    await ipcService.invoke<void>(
      'project:save',
      {
        path,
        projectFile,
        portableMode: options?.portableMode,
        strictSourceFiles: options?.strictSourceFiles,
      },
      notify,
    );
  }

  async savePortableAs(
    parentPath: string,
    projectFile: ProjectFile,
    options?: { notifyOnIpcError?: boolean },
  ): Promise<{ cherryPath: string; folderPath: string }> {
    const notify = options?.notifyOnIpcError !== false;
    return ipcService.invoke<{ cherryPath: string; folderPath: string }>(
      'project:savePortableAs',
      {
        parentPath,
        projectFile,
      },
      notify,
    );
  }

  async loadProject(filePath: string): Promise<ProjectStateData> {
    const rawData = await ipcService.invoke<unknown>('project:load', { path: filePath });
    return this.loadProjectFromData(rawData, filePath);
  }

  async loadProjectFromData(rawData: unknown, filePath: string): Promise<ProjectStateData> {
    const validationResult = validateProjectFile(rawData);

    if (!validationResult.isValid || !validationResult.data) {
      const errorMessage = validationResult.errors.join('; ');
      throw new Error(`Invalid project file: ${errorMessage}`);
    }

    if (validationResult.warnings.length > 0) {
      console.warn('Project file warnings:', validationResult.warnings);
    }

    const integrityWarnings = validateProjectIntegrity(validationResult.data);
    if (integrityWarnings.length > 0) {
      console.warn('Project integrity warnings:', integrityWarnings);
    }

    const projectData = this.deserializeProject(validationResult.data);

    if (filePath) {
      await resolveAndCheckTracks(projectData.items, filePath);
      for (const collection of projectData.collections ?? []) {
        await resolveAndCheckTracks(collection.items, filePath, {
          portableCollectionName: validationResult.data.settings.portableMode
            ? collection.name
            : undefined,
        });
      }
    }

    return projectData;
  }

  serializeProject(state: ProjectStateData): ProjectFile {
    const serializedItems = serializeItems(state.items);

    const trackSettingsRecord: Record<string, ProjectTrackSettings> = {};
    state.trackSettings.forEach((value, key) => {
      trackSettingsRecord[key] = value;
    });

    const groupSettingsRecord: Record<string, ProjectGroupSettings> = {};
    state.groupSettings.forEach((value, key) => {
      groupSettingsRecord[key] = value;
    });

    return {
      version: '2.1',
      name: state.name,
      items: serializedItems.items,
      rootItems: serializedItems.rootItems,
      settings: state.settings,
      trackSettings: trackSettingsRecord,
      groupSettings: groupSettingsRecord,
      sessionState: state.sessionState,
      ...(state.linkedParty && { linkedParty: state.linkedParty }),
      partyTrackDisplay: state.partyTrackDisplay ?? DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
      ...(state.partyThemeId !== undefined ? { partyThemeId: state.partyThemeId } : {}),
      ...(state.partyCustomizationSettings !== undefined
        ? { partyCustomizationSettings: state.partyCustomizationSettings }
        : {}),
      ...(state.collections !== undefined
        ? { collections: state.collections.map((collection) => ({
            id: collection.id,
            name: collection.name,
            ...serializeItems(collection.items),
          })) }
        : {}),
      ...(state.collectionViewState !== undefined
        ? { collectionViewState: state.collectionViewState }
        : {}),
    };
  }

  deserializeProject(file: ProjectFile): ProjectStateData {
    const items = deserializeItems(file.items, file.rootItems);

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
      partyThemeId: file.partyThemeId,
      partyCustomizationSettings: file.partyCustomizationSettings,
      ...(file.collections !== undefined
        ? {
            collections: file.collections.map((collection) => ({
              id: collection.id,
              name: collection.name,
              items: deserializeItems(collection.items, collection.rootItems),
            })),
          }
        : {}),
      ...(file.collectionViewState !== undefined
        ? { collectionViewState: file.collectionViewState }
        : {}),
    };
  }
}

export const projectService = new ProjectService();
