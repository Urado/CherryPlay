import { Track } from './track';

/**
 * Действие после окончания трека
 */
export type ActionAfterTrack = 'next' | 'pauseAndNext' | 'pause';

/**
 * Режим сессии проекта
 */
export type ProjectSessionMode = 'preparation' | 'session';

/**
 * Группа в проекте
 * Может содержать треки и другие группы (рекурсивная структура)
 */
export interface ProjectGroup {
  id: string;
  name: string;
  items: ProjectItem[];
}

/**
 * Элемент проекта - может быть треком или группой
 */
export type ProjectItem = Track | ProjectGroup;

/**
 * Type guard для проверки, является ли элемент группой
 */
export function isProjectGroup(item: ProjectItem): item is ProjectGroup {
  return 'items' in item;
}

/**
 * Type guard для проверки, является ли элемент треком
 */
export function isProjectTrack(item: ProjectItem): item is Track {
  return !isProjectGroup(item);
}

/**
 * Настройки отдельного трека
 */
export interface ProjectTrackSettings {
  pauseBetweenTracks?: number | null;
  actionAfterTrack?: ActionAfterTrack | null;
}

/**
 * Настройки группы
 */
export interface ProjectGroupSettings {
  pauseBetweenTracks?: number | null;
  actionAfterTrack?: ActionAfterTrack | null;
}

/**
 * Глобальные настройки проекта
 */
export interface ProjectSettings {
  defaultPauseBetweenTracks: number;
  defaultActionAfterTrack: ActionAfterTrack;
  plannedEndTime: number | null;
}

/**
 * Состояние сессии проекта
 */
export interface ProjectSessionState {
  mode: ProjectSessionMode;
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  currentTrackId: string | null;
  sessionStartTime: number | null;
}

/**
 * Метаданные проекта (не сохраняются в файл)
 */
export interface ProjectMeta {
  filePath: string | null;
  isDirty: boolean;
  lastSavedAt: number | null;
}

// ============================================
// Типы для сериализации в файл .cherry
// ============================================

/**
 * Трек для сохранения в файл
 */
export interface SavedProjectTrack {
  type: 'track';
  id: string;
  path: string;
  name: string;
  duration?: number;
}

/**
 * Группа для сохранения в файл
 * items содержит ID треков и групп (не вложенные объекты)
 */
export interface SavedProjectGroup {
  type: 'group';
  id: string;
  name: string;
  items: string[]; // ID элементов
}

/**
 * Элемент для сохранения - либо трек, либо группа
 */
export type SavedProjectItem = SavedProjectTrack | SavedProjectGroup;

/**
 * Полный формат файла .cherry
 */
export interface ProjectFile {
  version: '2.0';
  name: string;
  items: SavedProjectItem[];
  rootItems: string[]; // Порядок корневых элементов (ID)
  settings: ProjectSettings;
  trackSettings: Record<string, ProjectTrackSettings>;
  groupSettings: Record<string, ProjectGroupSettings>;
  sessionState?: ProjectSessionState;
}

// ============================================
// Значения по умолчанию
// ============================================

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  defaultPauseBetweenTracks: 0,
  defaultActionAfterTrack: 'next',
  plannedEndTime: null,
};

export const DEFAULT_SESSION_STATE: ProjectSessionState = {
  mode: 'preparation',
  playedTrackIds: [],
  disabledTrackIds: [],
  disabledGroupIds: [],
  currentTrackId: null,
  sessionStartTime: null,
};

export const DEFAULT_PROJECT_META: ProjectMeta = {
  filePath: null,
  isDirty: false,
  lastSavedAt: null,
};
