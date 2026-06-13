import type { Track, TrackLoudness } from './track';

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
  portableMode: boolean;
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

/** Привязка проекта к вечеринке на сервере */
export interface LinkedParty {
  id: string;
  shortCode: string;
  url?: string;
}

/**
 * Настройки отображения имён треков для вечеринки (локально / в проекте, не Party customizationSettings API).
 */
export interface PartyTrackDisplaySettings {
  /** Обрезать заданное число символов с начала имени при превью и при отправке плейлиста на сервер */
  stripLeadingCharsEnabled: boolean;
  /** Сколько символов (Unicode code points) убрать с начала (при включённой опции) */
  stripLeadingCharsCount: number;
}

export const DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS: PartyTrackDisplaySettings = {
  stripLeadingCharsEnabled: false,
  stripLeadingCharsCount: 0,
};

/**
 * Метаданные проекта (filePath/isDirty/lastSavedAt не в файле; linkedParty сохраняется в файл)
 */
export interface ProjectMeta {
  filePath: string | null;
  isDirty: boolean;
  lastSavedAt: number | null;
  /** Привязка к вечеринке на сервере (сохраняется в .cherry) */
  linkedParty: LinkedParty | null;
  /** Отображение треков на странице вечеринки; сохраняется в .cherry и в persist стора */
  partyTrackDisplay: PartyTrackDisplaySettings;
  /**
   * Черновик/кэш темы вечеринки (совпадает по смыслу с Party.partyThemeId на сервере).
   * Локальное состояние до синхронизации и после офлайн-редактирования.
   */
  partyThemeId?: string;
  /**
   * Черновик/кэш настроек кастомизации темы (совпадает с Party.customizationSettings на сервере).
   * Локальный JSON-объект; не подставляется автоматически как источник правды для API без явной публикации.
   */
  partyCustomizationSettings?: Record<string, unknown>;
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
  loudness?: TrackLoudness;
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
  /** Привязка к вечеринке на сервере (url не сохраняется, регенерируется при запуске) */
  linkedParty?: Pick<LinkedParty, 'id' | 'shortCode'>;
  /** Настройки отображения имён треков для вечеринки (не customization вечеринки на API) */
  partyTrackDisplay?: PartyTrackDisplaySettings;
  /** Черновик темы вечеринки (локально; зеркало серверного поля) */
  partyThemeId?: string;
  /** Черновик customization темы (локально; зеркало серверного поля) */
  partyCustomizationSettings?: Record<string, unknown>;
}

// ============================================
// Значения по умолчанию
// ============================================

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  defaultPauseBetweenTracks: 0,
  defaultActionAfterTrack: 'next',
  plannedEndTime: null,
  portableMode: false,
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
  linkedParty: null,
  partyTrackDisplay: { ...DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS },
};
