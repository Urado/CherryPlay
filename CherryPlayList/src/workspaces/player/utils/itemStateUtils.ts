import { ProjectItem, isProjectGroup, isProjectTrack, ActionAfterTrack } from '@core/types/project';
import { Track } from '@core/types/track';

/**
 * Результат проверки состояния элемента
 */
export interface ItemState {
  isPlayed: boolean;
  isDisabled: boolean;
}

/**
 * Проверяет состояние элемента (трека или группы)
 * @param item - Элемент для проверки
 * @param isTrackPlayed - Функция проверки проигранности трека
 * @param isGroupDisabled - Функция проверки отключенности группы
 * @param isTrackOrGroupDisabled - Функция проверки отключенности трека или его родительских групп
 * @param getAllTracksInOrder - Функция получения всех треков из группы
 * @returns Состояние элемента
 */
export function getItemState(
  item: ProjectItem,
  isTrackPlayed: (id: string) => boolean,
  isGroupDisabled: (id: string) => boolean,
  isTrackOrGroupDisabled: (id: string) => boolean,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
): ItemState {
  if (isProjectGroup(item)) {
    // Для группы проверяем состояние всех треков внутри
    const groupTracks = getAllTracksInOrder([item]);
    const isPlayed = groupTracks.length > 0 && groupTracks.every((t) => isTrackPlayed(t.id));
    const isDisabled = isGroupDisabled(item.id);
    return { isPlayed, isDisabled };
  } else if (isProjectTrack(item)) {
    // Для трека проверяем его состояние и состояние родительских групп
    const isPlayed = isTrackPlayed(item.id);
    const isDisabled = isTrackOrGroupDisabled(item.id);
    return { isPlayed, isDisabled };
  }
  // Fallback для неизвестных типов
  return { isPlayed: false, isDisabled: false };
}

/**
 * Проверяет, заблокирован ли элемент (нельзя удалять/перемещать в режиме сессии)
 * @param item - Элемент для проверки
 * @param isPreparationMode - Режим подготовки
 * @param activePlayerTrackId - ID текущего активного трека
 * @param itemState - Состояние элемента
 * @param getAllTracksInOrder - Функция получения всех треков из группы
 * @param isTrackPlayed - Функция проверки проигранности трека
 * @returns true, если элемент заблокирован
 */
export function isItemLocked(
  item: ProjectItem,
  isPreparationMode: boolean,
  activePlayerTrackId: string | null | undefined,
  itemState: ItemState,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
  isTrackPlayed: (id: string) => boolean,
): boolean {
  if (isPreparationMode) {
    return false;
  }

  const track = isProjectTrack(item) ? item : null;
  const isCurrentTrack = track?.id === activePlayerTrackId;

  // Элемент заблокирован, если он проигран или является текущим треком
  if (itemState.isPlayed || isCurrentTrack) {
    return true;
  }

  // Для группы проверяем, содержит ли она проигранные или текущий трек
  if (isProjectGroup(item)) {
    const groupTracks = getAllTracksInOrder([item]);
    return groupTracks.some((t) => isTrackPlayed(t.id) || t.id === activePlayerTrackId);
  }

  return false;
}

/**
 * Вычисляет длительность группы с учетом пауз между треками
 * @param group - Группа для вычисления
 * @param getAllTracksInOrder - Функция получения всех треков из группы
 * @param getEffectiveTrackSettings - Функция получения эффективных настроек трека
 * @returns Длительность группы в секундах или undefined, если нет треков с длительностью
 */
export function calculateGroupDurationWithPauses(
  group: ProjectItem,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: ActionAfterTrack;
    pauseBetweenTracks: number;
  },
): number | undefined {
  if (!isProjectGroup(group)) {
    return undefined;
  }

  const groupTracks = getAllTracksInOrder([group]);
  let total = 0;

  for (let i = 0; i < groupTracks.length; i++) {
    const groupTrack = groupTracks[i];
    total += groupTrack.duration || 0;
    // Получаем эффективные настройки для трека (учитывает иерархию: трек -> группа -> глобальные)
    const settings = getEffectiveTrackSettings(groupTrack.id);
    // Если действие "pauseAndNext", добавляем время паузы
    if (settings.actionAfterTrack === 'pauseAndNext') {
      // Добавляем паузу после каждого трека с настройкой pauseAndNext
      // (включая последний трек в группе)
      total += settings.pauseBetweenTracks || 0;
    }
  }

  // Если есть хотя бы один трек с длительностью, возвращаем результат
  const hasAnyDuration = groupTracks.some((t) => t.duration && t.duration > 0);
  return hasAnyDuration ? total : undefined;
}
