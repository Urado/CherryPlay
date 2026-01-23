import { ProjectItem, isProjectGroup, isProjectTrack } from '@core/types/project';
import { Track } from '@core/types/track';

/**
 * Проверяет, отключен ли трек или его родительские группы
 */
export function isTrackOrGroupDisabled(
  itemId: string,
  isTrackDisabled: (id: string) => boolean,
  isGroupDisabled: (id: string) => boolean,
  getItemPath: (id: string) => string[],
  findItemById: (id: string) => ProjectItem | null,
): boolean {
  // Проверяем, отключен ли сам трек
  if (isTrackDisabled(itemId)) {
    return true;
  }

  // Проверяем родительские группы
  const path = getItemPath(itemId);
  // Путь содержит: [rootGroupId, innerGroupId, ..., itemId]
  // Проверяем все элементы пути кроме последнего (самого элемента)
  if (path.length > 1) {
    for (let i = path.length - 2; i >= 0; i--) {
      const groupId = path[i];
      // Убеждаемся, что это действительно группа, а не трек
      const item = findItemById(groupId);
      if (item && isProjectGroup(item) && isGroupDisabled(groupId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Проверяет, является ли трек активным (не проигран и не отключен)
 */
export function isTrackActive(
  trackId: string,
  isTrackPlayed: (id: string) => boolean,
  isTrackOrGroupDisabled: (id: string) => boolean,
): boolean {
  return !isTrackPlayed(trackId) && !isTrackOrGroupDisabled(trackId);
}

/**
 * Помечает пропущенные отключённые треки как проигранные
 */
export function markSkippedDisabledTracks(
  fromIndex: number,
  toIndex: number,
  allTracks: Track[],
  isTrackOrGroupDisabled: (id: string) => boolean,
  isTrackPlayed: (id: string) => boolean,
  markTrackAsPlayed: (id: string) => void,
): void {
  for (let i = fromIndex + 1; i < toIndex; i++) {
    const track = allTracks[i];
    if (track && isTrackOrGroupDisabled(track.id) && !isTrackPlayed(track.id)) {
      markTrackAsPlayed(track.id);
    }
  }
}

/**
 * Проверяет, можно ли удалить выбранные элементы
 * (не должно быть проигранных или текущего в режиме сессии)
 */
export function canRemoveSelectedItems(
  selectedItemIds: Set<string>,
  isPreparationMode: boolean,
  activePlayerTrackId: string | null | undefined,
  findItemById: (id: string) => ProjectItem | null,
  isTrackPlayed: (id: string) => boolean,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
): boolean {
  if (isPreparationMode) {
    return true;
  }

  return Array.from(selectedItemIds).every((itemId) => {
    const item = findItemById(itemId);
    if (!item) {
      return true;
    }

    // Для треков проверяем проигранность и текущий статус
    if (isProjectTrack(item)) {
      const trackIsPlayed = isTrackPlayed(itemId);
      const isCurrentTrack = itemId === activePlayerTrackId;
      return !trackIsPlayed && !isCurrentTrack;
    }

    // Для групп проверяем, что внутри нет проигранных или текущего трека
    if (isProjectGroup(item)) {
      const groupTracks = getAllTracksInOrder([item]);
      return groupTracks.every((track) => {
        const trackIsPlayed = isTrackPlayed(track.id);
        const isCurrentTrack = track.id === activePlayerTrackId;
        return !trackIsPlayed && !isCurrentTrack;
      });
    }

    return true;
  });
}

/**
 * Проверяет, являются ли выбранные элементы соседними
 */
export function areItemsConsecutive(
  itemIds: string[],
  items: ProjectItem[],
  getItemPath: (id: string) => string[],
  findItemById: (id: string) => ProjectItem | null,
): boolean {
  if (itemIds.length < 2) return false;

  // Получаем пути для всех элементов
  const itemPaths = itemIds.map((id) => ({
    id,
    path: getItemPath(id) || [],
  }));

  // Проверяем, что все элементы находятся в одном контейнере (корневой список или одна группа)
  const firstPath = itemPaths[0].path;
  const parentId = firstPath.length > 1 ? firstPath[firstPath.length - 2] : null;

  // Проверяем, что все элементы имеют одного родителя
  for (let i = 1; i < itemPaths.length; i++) {
    const currentPath = itemPaths[i].path;
    const currentParentId = currentPath.length > 1 ? currentPath[currentPath.length - 2] : null;
    if (currentParentId !== parentId) {
      return false;
    }
  }

  // Находим родительский контейнер
  let parentContainer: ProjectItem[];
  if (parentId === null) {
    // Элементы в корневом списке
    parentContainer = items;
  } else {
    // Элементы внутри группы - находим группу
    const parentGroup = findItemById(parentId);
    if (!parentGroup || !isProjectGroup(parentGroup)) {
      return false;
    }
    parentContainer = parentGroup.items;
  }

  // Находим индексы элементов в родительском контейнере
  const itemIndices: number[] = [];
  for (const itemId of itemIds) {
    const index = parentContainer.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return false;
    }
    itemIndices.push(index);
  }

  // Проверяем, что элементы соседние
  const sortedIndices = [...itemIndices].sort((a, b) => a - b);
  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] !== sortedIndices[i - 1] + 1) {
      return false;
    }
  }

  return true;
}
