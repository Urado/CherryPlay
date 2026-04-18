import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_SESSION_STATE,
  PartyTrackDisplaySettings,
  ProjectFile,
  ProjectGroupSettings,
  ProjectSessionState,
  ProjectSettings,
  ProjectTrackSettings,
  SavedProjectGroup,
  SavedProjectItem,
  SavedProjectTrack,
} from '@core/types/project';

/**
 * Результат валидации проекта
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data: ProjectFile | null;
}

/**
 * Проверяет, является ли значение объектом
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Проверяет, является ли значение массивом
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Проверяет, является ли значение строкой
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Проверяет, является ли значение числом
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function validatePartyCustomizationSettings(
  raw: unknown,
  warnings: string[],
): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!isObject(raw) || isArray(raw)) {
    warnings.push('Invalid partyCustomizationSettings, omitting');
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  } catch {
    warnings.push('Invalid partyCustomizationSettings, omitting');
    return undefined;
  }
}

function validatePartyTrackDisplay(raw: unknown, warnings: string[]): PartyTrackDisplaySettings {
  if (!isObject(raw)) {
    warnings.push('Invalid partyTrackDisplay, using defaults');
    return { ...DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS };
  }
  const enabled = isBoolean(raw.stripLeadingCharsEnabled) ? raw.stripLeadingCharsEnabled : false;
  let count = 0;
  if (isNumber(raw.stripLeadingCharsCount) && isFinite(raw.stripLeadingCharsCount)) {
    count = Math.max(0, Math.floor(raw.stripLeadingCharsCount));
  } else if (raw.stripLeadingCharsCount !== undefined) {
    warnings.push('Invalid stripLeadingCharsCount in partyTrackDisplay, using 0');
  }
  return {
    stripLeadingCharsEnabled: enabled,
    stripLeadingCharsCount: count,
  };
}

/**
 * Валидирует ActionAfterTrack
 */
function isValidActionAfterTrack(value: unknown): boolean {
  return value === 'next' || value === 'pauseAndNext' || value === 'pause';
}

/**
 * Валидирует SavedProjectTrack
 */
function validateSavedTrack(item: unknown, errors: string[]): item is SavedProjectTrack {
  if (!isObject(item)) {
    errors.push('Track item is not an object');
    return false;
  }

  if (item.type !== 'track') {
    errors.push(`Expected track type, got: ${item.type}`);
    return false;
  }

  if (!isString(item.id) || item.id.length === 0) {
    errors.push('Track missing valid id');
    return false;
  }

  if (!isString(item.path) || item.path.length === 0) {
    errors.push(`Track ${item.id} missing valid path`);
    return false;
  }

  if (!isString(item.name)) {
    errors.push(`Track ${item.id} missing valid name`);
    return false;
  }

  if (item.duration !== undefined && !isNumber(item.duration)) {
    errors.push(`Track ${item.id} has invalid duration`);
    return false;
  }

  return true;
}

/**
 * Валидирует SavedProjectGroup
 */
function validateSavedGroup(item: unknown, errors: string[]): item is SavedProjectGroup {
  if (!isObject(item)) {
    errors.push('Group item is not an object');
    return false;
  }

  if (item.type !== 'group') {
    errors.push(`Expected group type, got: ${item.type}`);
    return false;
  }

  if (!isString(item.id) || item.id.length === 0) {
    errors.push('Group missing valid id');
    return false;
  }

  if (!isString(item.name)) {
    errors.push(`Group ${item.id} missing valid name`);
    return false;
  }

  if (!isArray(item.items)) {
    errors.push(`Group ${item.id} missing items array`);
    return false;
  }

  for (const childId of item.items) {
    if (!isString(childId)) {
      errors.push(`Group ${item.id} has invalid child id`);
      return false;
    }
  }

  return true;
}

/**
 * Валидирует SavedProjectItem
 */
function validateSavedItem(item: unknown, errors: string[]): item is SavedProjectItem {
  if (!isObject(item)) {
    errors.push('Item is not an object');
    return false;
  }

  if (item.type === 'track') {
    return validateSavedTrack(item, errors);
  } else if (item.type === 'group') {
    return validateSavedGroup(item, errors);
  } else {
    errors.push(`Unknown item type: ${item.type}`);
    return false;
  }
}

/**
 * Валидирует ProjectSettings с graceful degradation
 */
function validateSettings(settings: unknown, warnings: string[]): ProjectSettings {
  const result = { ...DEFAULT_PROJECT_SETTINGS };

  if (!isObject(settings)) {
    warnings.push('Settings is not an object, using defaults');
    return result;
  }

  if (isNumber(settings.defaultPauseBetweenTracks)) {
    result.defaultPauseBetweenTracks = settings.defaultPauseBetweenTracks;
  } else if (settings.defaultPauseBetweenTracks !== undefined) {
    warnings.push('Invalid defaultPauseBetweenTracks, using default');
  }

  if (isValidActionAfterTrack(settings.defaultActionAfterTrack)) {
    result.defaultActionAfterTrack =
      settings.defaultActionAfterTrack as ProjectSettings['defaultActionAfterTrack'];
  } else if (settings.defaultActionAfterTrack !== undefined) {
    warnings.push('Invalid defaultActionAfterTrack, using default');
  }

  if (settings.plannedEndTime === null || isNumber(settings.plannedEndTime)) {
    result.plannedEndTime = settings.plannedEndTime as number | null;
  } else if (settings.plannedEndTime !== undefined) {
    warnings.push('Invalid plannedEndTime, using default');
  }

  if (typeof settings.portableMode === 'boolean') {
    result.portableMode = settings.portableMode;
  } else if (settings.portableMode !== undefined) {
    warnings.push('Invalid portableMode value, using default');
  }

  return result;
}

/**
 * Валидирует ProjectSessionState с graceful degradation
 */
function validateSessionState(sessionState: unknown, warnings: string[]): ProjectSessionState {
  const result = { ...DEFAULT_SESSION_STATE };

  if (!isObject(sessionState)) {
    return result;
  }

  if (sessionState.mode === 'preparation' || sessionState.mode === 'session') {
    result.mode = sessionState.mode;
  } else if (sessionState.mode !== undefined) {
    warnings.push('Invalid session mode, using default');
  }

  if (isArray(sessionState.playedTrackIds)) {
    result.playedTrackIds = sessionState.playedTrackIds.filter(isString);
  }

  if (isArray(sessionState.disabledTrackIds)) {
    result.disabledTrackIds = sessionState.disabledTrackIds.filter(isString);
  }

  if (isArray(sessionState.disabledGroupIds)) {
    result.disabledGroupIds = sessionState.disabledGroupIds.filter(isString);
  }

  if (sessionState.currentTrackId === null || isString(sessionState.currentTrackId)) {
    result.currentTrackId = sessionState.currentTrackId;
  }

  if (sessionState.sessionStartTime === null || isNumber(sessionState.sessionStartTime)) {
    result.sessionStartTime = sessionState.sessionStartTime;
  }

  return result;
}

/**
 * Валидирует trackSettings
 */
function validateTrackSettings(
  trackSettings: unknown,
  warnings: string[],
): Record<string, ProjectTrackSettings> {
  const result: Record<string, ProjectTrackSettings> = {};

  if (!isObject(trackSettings)) {
    if (trackSettings !== undefined) {
      warnings.push('Invalid trackSettings, using empty');
    }
    return result;
  }

  for (const [key, value] of Object.entries(trackSettings)) {
    if (!isObject(value)) {
      warnings.push(`Invalid track settings for ${key}, skipping`);
      continue;
    }

    const settings: ProjectTrackSettings = {};

    if (value.pauseBetweenTracks === null || isNumber(value.pauseBetweenTracks)) {
      settings.pauseBetweenTracks = value.pauseBetweenTracks as number | null;
    }

    if (value.actionAfterTrack === null || isValidActionAfterTrack(value.actionAfterTrack)) {
      settings.actionAfterTrack =
        value.actionAfterTrack as ProjectTrackSettings['actionAfterTrack'];
    }

    result[key] = settings;
  }

  return result;
}

/**
 * Валидирует groupSettings
 */
function validateGroupSettings(
  groupSettings: unknown,
  warnings: string[],
): Record<string, ProjectGroupSettings> {
  const result: Record<string, ProjectGroupSettings> = {};

  if (!isObject(groupSettings)) {
    if (groupSettings !== undefined) {
      warnings.push('Invalid groupSettings, using empty');
    }
    return result;
  }

  for (const [key, value] of Object.entries(groupSettings)) {
    if (!isObject(value)) {
      warnings.push(`Invalid group settings for ${key}, skipping`);
      continue;
    }

    const settings: ProjectGroupSettings = {};

    if (value.pauseBetweenTracks === null || isNumber(value.pauseBetweenTracks)) {
      settings.pauseBetweenTracks = value.pauseBetweenTracks as number | null;
    }

    if (value.actionAfterTrack === null || isValidActionAfterTrack(value.actionAfterTrack)) {
      settings.actionAfterTrack =
        value.actionAfterTrack as ProjectGroupSettings['actionAfterTrack'];
    }

    result[key] = settings;
  }

  return result;
}

/**
 * Валидирует файл проекта .cherry
 * Возвращает результат валидации с graceful degradation
 */
export function validateProjectFile(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Проверяем базовую структуру
  if (!isObject(data)) {
    return {
      isValid: false,
      errors: ['Project file is not a valid object'],
      warnings: [],
      data: null,
    };
  }

  // Проверяем версию
  if (data.version !== '2.0') {
    if (data.version === undefined) {
      errors.push('Missing version field');
    } else {
      errors.push(`Unsupported version: ${data.version}`);
    }
  }

  // Проверяем name
  let name = 'Untitled';
  if (isString(data.name)) {
    name = data.name;
  } else {
    warnings.push('Missing or invalid name, using "Untitled"');
  }

  // Проверяем items
  const items: SavedProjectItem[] = [];
  if (!isArray(data.items)) {
    errors.push('Missing or invalid items array');
  } else {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (validateSavedItem(item, errors)) {
        items.push(item);
      } else {
        warnings.push(`Skipping invalid item at index ${i}`);
      }
    }
  }

  // Проверяем rootItems
  let rootItems: string[] = [];
  if (!isArray(data.rootItems)) {
    errors.push('Missing or invalid rootItems array');
    // Fallback: use all top-level item IDs
    rootItems = items.map((item) => item.id);
    warnings.push('Using all items as root items');
  } else {
    rootItems = data.rootItems.filter(isString);
    if (rootItems.length !== data.rootItems.length) {
      warnings.push('Some rootItems were invalid and filtered out');
    }
  }

  // Валидируем settings с graceful degradation
  const settings = validateSettings(data.settings, warnings);

  // Валидируем trackSettings
  const trackSettings = validateTrackSettings(data.trackSettings, warnings);

  // Валидируем groupSettings
  const groupSettings = validateGroupSettings(data.groupSettings, warnings);

  // Валидируем sessionState
  const sessionState = validateSessionState(data.sessionState, warnings);

  const partyTrackDisplay =
    data.partyTrackDisplay !== undefined
      ? validatePartyTrackDisplay(data.partyTrackDisplay, warnings)
      : { ...DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS };

  let partyThemeId: string | undefined;
  if (data.partyThemeId !== undefined) {
    if (isString(data.partyThemeId)) {
      partyThemeId = data.partyThemeId;
    } else {
      warnings.push('Invalid partyThemeId, omitting');
    }
  }

  const partyCustomizationSettings =
    data.partyCustomizationSettings !== undefined
      ? validatePartyCustomizationSettings(data.partyCustomizationSettings, warnings)
      : undefined;

  // Если есть критические ошибки, возвращаем null
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      data: null,
    };
  }

  // Собираем валидный ProjectFile
  const projectFile: ProjectFile = {
    version: '2.0',
    name,
    items,
    rootItems,
    settings,
    trackSettings,
    groupSettings,
    sessionState,
    partyTrackDisplay,
    ...(partyThemeId !== undefined ? { partyThemeId } : {}),
    ...(partyCustomizationSettings !== undefined ? { partyCustomizationSettings } : {}),
  };

  return {
    isValid: true,
    errors: [],
    warnings,
    data: projectFile,
  };
}

/**
 * Проверяет целостность ссылок в проекте
 * (все rootItems и group.items ссылаются на существующие элементы)
 */
export function validateProjectIntegrity(projectFile: ProjectFile): string[] {
  const warnings: string[] = [];
  const itemIds = new Set(projectFile.items.map((item) => item.id));

  // Проверяем rootItems
  for (const rootId of projectFile.rootItems) {
    if (!itemIds.has(rootId)) {
      warnings.push(`Root item ${rootId} not found in items`);
    }
  }

  // Проверяем ссылки в группах
  for (const item of projectFile.items) {
    if (item.type === 'group') {
      for (const childId of item.items) {
        if (!itemIds.has(childId)) {
          warnings.push(`Group ${item.id} references non-existent item ${childId}`);
        }
      }
    }
  }

  return warnings;
}
