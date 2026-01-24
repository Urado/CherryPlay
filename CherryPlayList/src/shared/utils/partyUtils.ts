import { ProjectItem, isProjectGroup, isProjectTrack } from '@core/types/project';
import { PlayerItem as ComponentPlayerItem } from '@cherryplay/components/types';

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
export function convertToComponentPlayerItems(
  items: ProjectItem[],
): ComponentPlayerItem[] {
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

/**
 * Преобразует ProjectItem из приложения в формат для API (без path)
 */
export function convertToApiPlayerItem(
  item: ProjectItem,
  displayOrder: number = 0,
  level: number = 0,
): PlayerItemForApi {
  if (isProjectGroup(item)) {
    return {
      id: item.id,
      type: 'group',
      name: item.name || 'Группа',
      items: item.items.map((childItem, index) =>
        convertToApiPlayerItem(childItem, index, level + 1),
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
      // path намеренно не включается
    };
  }
}

/**
 * Преобразует массив ProjectItem в формат для API (без path)
 */
export function convertToApiPlayerItems(items: ProjectItem[]): PlayerItemForApi[] {
  return items.map((item, index) => convertToApiPlayerItem(item, index, 0));
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
export function convertPlaylistForApi(items: ProjectItem[]): {
  items: PlayerItemForApi[];
  totalTracks: number;
  totalDuration: number;
} {
  const apiItems = convertToApiPlayerItems(items);
  const metadata = calculatePlaylistMetadata(items);
  
  return {
    items: apiItems,
    totalTracks: metadata.totalTracks,
    totalDuration: metadata.totalDuration,
  };
}
