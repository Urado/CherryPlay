import { PlayerItem as ComponentPlayerItem } from '@cherryplay/components/types';

import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  type PartyTrackDisplaySettings,
  ProjectItem,
  isProjectGroup,
  isProjectTrack,
} from '@core/types/project';

/**
 * Интерфейс для PlayerItem без path (для API)
 */
export interface PlayerItemForApi {
  id: string;
  type: 'track' | 'group';
  name: string;
  duration?: number;
  items?: PlayerItemForApi[];
  displayOrder: number;
  level: number;
}

/**
 * Имя трека для API/превью вечеринки с учётом настроек отображения (графемы Unicode).
 */
export function normalizePartyTrackDisplaySettings(
  settings: PartyTrackDisplaySettings,
): PartyTrackDisplaySettings {
  const mode = settings.stripLeadingCharsMode === 'untilDelimiter' ? 'untilDelimiter' : 'count';
  const delimiterRaw = settings.stripLeadingCharsDelimiter;
  const delimiter =
    typeof delimiterRaw === 'string' && delimiterRaw.length > 0
      ? delimiterRaw.slice(0, 1)
      : DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS.stripLeadingCharsDelimiter;
  const count =
    Number.isFinite(settings.stripLeadingCharsCount) && settings.stripLeadingCharsCount > 0
      ? Math.max(0, Math.floor(settings.stripLeadingCharsCount))
      : 0;

  return {
    stripLeadingCharsEnabled: Boolean(settings.stripLeadingCharsEnabled),
    stripLeadingCharsMode: mode,
    stripLeadingCharsCount: count,
    stripLeadingCharsDelimiter: delimiter,
  };
}

export function applyPartyTrackDisplayToTrackName(
  name: string,
  settings: PartyTrackDisplaySettings = DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
): string {
  const normalized = normalizePartyTrackDisplaySettings(settings);
  if (!normalized.stripLeadingCharsEnabled) {
    return name;
  }

  if (normalized.stripLeadingCharsMode === 'untilDelimiter') {
    const delimiter = normalized.stripLeadingCharsDelimiter;
    const index = name.indexOf(delimiter);
    if (index === -1) {
      return name;
    }
    const rest = name.slice(index + delimiter.length);
    return rest.length > 0 ? rest : name;
  }

  if (normalized.stripLeadingCharsCount <= 0) {
    return name;
  }
  const chars = [...name];
  const n = Math.min(normalized.stripLeadingCharsCount, chars.length);
  const rest = chars.slice(n).join('');
  return rest.length > 0 ? rest : name;
}

export function applyPartyTrackDisplayToComponentPlaylist(
  items: ComponentPlayerItem[],
  settings: PartyTrackDisplaySettings = DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
): ComponentPlayerItem[] {
  return items.map((item) => {
    if (item.type === 'group') {
      const nested = item.items ?? [];
      return {
        ...item,
        items: applyPartyTrackDisplayToComponentPlaylist(nested, settings),
      };
    }
    return {
      ...item,
      name: applyPartyTrackDisplayToTrackName(item.name, settings),
    };
  });
}

/**
 * Преобразует ProjectItem из приложения в формат для библиотеки компонентов
 */
export function convertToComponentPlayerItem(
  item: ProjectItem,
  displayOrder: number = 0,
  level: number = 0,
): ComponentPlayerItem {
  if (isProjectGroup(item)) {
    return {
      id: item.id,
      type: 'group',
      name: item.name || 'Группа',
      items: item.items.map((childItem, index) =>
        convertToComponentPlayerItem(childItem, index, level + 1),
      ),
      displayOrder,
      level,
    };
  } else {
    return {
      id: item.id,
      type: 'track',
      name: item.name,
      duration: item.duration,
      displayOrder,
      level,
    };
  }
}

/**
 * Преобразует массив ProjectItem в формат для библиотеки компонентов
 */
export function convertToComponentPlayerItems(items: ProjectItem[]): ComponentPlayerItem[] {
  return items.map((item, index) => convertToComponentPlayerItem(item, index, 0));
}

/**
 * Вычисляет общую длительность плейлиста
 */
export function calculateTotalDuration(items: ProjectItem[]): number {
  let total = 0;
  for (const item of items) {
    if (isProjectTrack(item)) {
      total += item.duration || 0;
    } else if (isProjectGroup(item)) {
      total += calculateTotalDuration(item.items);
    }
  }
  return total;
}

/**
 * Подсчитывает общее количество треков
 */
export function countTotalTracks(items: ProjectItem[]): number {
  let count = 0;
  for (const item of items) {
    if (isProjectTrack(item)) {
      count++;
    } else if (isProjectGroup(item)) {
      count += countTotalTracks(item.items);
    }
  }
  return count;
}

/** Collects track ids from a component playlist tree (preview / playback helpers). */
export function collectComponentPlaylistTrackIds(items: ComponentPlayerItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.type === 'track') {
      ids.push(item.id);
      continue;
    }
    if (item.type === 'group' && item.items) {
      ids.push(...collectComponentPlaylistTrackIds(item.items));
    }
  }
  return ids;
}

/**
 * Преобразует ProjectItem из приложения в формат для API (без path)
 */
export function convertToApiPlayerItem(
  item: ProjectItem,
  displayOrder: number = 0,
  level: number = 0,
  trackDisplay?: PartyTrackDisplaySettings,
): PlayerItemForApi {
  if (isProjectGroup(item)) {
    return {
      id: item.id,
      type: 'group',
      name: item.name || 'Группа',
      items: item.items.map((childItem, index) =>
        convertToApiPlayerItem(childItem, index, level + 1, trackDisplay),
      ),
      displayOrder,
      level,
    };
  } else {
    const rawName = item.name;
    const name =
      trackDisplay !== undefined
        ? applyPartyTrackDisplayToTrackName(rawName, trackDisplay)
        : rawName;
    return {
      id: item.id,
      type: 'track',
      name,
      duration: item.duration,
      displayOrder,
      level,
      // path намеренно не включается
    };
  }
}

/**
 * Преобразует массив ProjectItem в формат для API (без path)
 */
export function convertToApiPlayerItems(
  items: ProjectItem[],
  trackDisplay?: PartyTrackDisplaySettings,
): PlayerItemForApi[] {
  return items.map((item, index) => convertToApiPlayerItem(item, index, 0, trackDisplay));
}

/**
 * Вычисляет метаданные плейлиста для API
 */
export function calculatePlaylistMetadata(items: ProjectItem[]): {
  totalTracks: number;
  totalDuration: number;
} {
  return {
    totalTracks: countTotalTracks(items),
    totalDuration: calculateTotalDuration(items),
  };
}

/**
 * Преобразует плейлист в формат для API с вычислением метаданных
 */
export function convertPlaylistForApi(
  items: ProjectItem[],
  trackDisplay?: PartyTrackDisplaySettings,
): {
  items: PlayerItemForApi[];
  totalTracks: number;
  totalDuration: number;
} {
  const apiItems = convertToApiPlayerItems(items, trackDisplay);
  const metadata = calculatePlaylistMetadata(items);

  return {
    items: apiItems,
    totalTracks: metadata.totalTracks,
    totalDuration: metadata.totalDuration,
  };
}
