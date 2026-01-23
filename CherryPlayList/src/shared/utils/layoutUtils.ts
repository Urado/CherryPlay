import { Zone, ContainerZone, ZoneId, SplitDirection } from '../../core/types/layout';

/**
 * Рекурсивный поиск зоны по ID
 * @param root - корневая зона для поиска
 * @param targetId - ID искомой зоны
 * @returns найденная зона или null
 */
export function findZoneById(root: Zone, targetId: ZoneId): Zone | null {
  if (root.id === targetId) {
    return root;
  }

  if (root.type === 'container') {
    for (const child of root.zones) {
      const found = findZoneById(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Рекурсивный поиск родительского контейнера для зоны
 * @param root - корневая зона для поиска
 * @param targetId - ID целевой зоны
 * @param parent - текущий родительский контейнер (для рекурсии)
 * @returns родительский контейнер или null
 */
export function findParentZone(
  root: Zone,
  targetId: ZoneId,
  parent: ContainerZone | null = null,
): ContainerZone | null {
  if (root.id === targetId) {
    return parent;
  }

  if (root.type === 'container') {
    for (const child of root.zones) {
      const found = findParentZone(child, targetId, root);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Подсчет общего количества зон в дереве
 * @param root - корневая зона
 * @returns общее количество зон
 */
export function countZones(root: Zone): number {
  if (root.type === 'workspace') {
    return 1;
  }

  return 1 + root.zones.reduce((sum, zone) => sum + countZones(zone), 0);
}

/**
 * Вычисление минимального процента для 10px
 * @param containerSize - размер контейнера в пикселях
 * @returns минимальный процент
 */
export function calculateMinSizePercent(containerSize: number): number {
  if (containerSize <= 0) {
    return 0;
  }
  return (10 / containerSize) * 100;
}

/**
 * Проверка глубины вложенности
 * @param root - корневая зона
 * @param currentDepth - текущая глубина (для рекурсии)
 * @returns максимальная глубина
 */
function getMaxDepth(root: Zone, currentDepth: number = 0): number {
  if (root.type === 'workspace') {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const child of root.zones) {
    const childDepth = getMaxDepth(child, currentDepth + 1);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

/**
 * Валидация layout
 * @param root - корневая зона для валидации
 * @param containerWidth - ширина контейнера в пикселях
 * @param containerHeight - высота контейнера в пикселях
 * @returns true если layout валиден
 */
export function validateLayout(
  root: Zone,
  containerWidth: number,
  containerHeight: number,
): boolean {
  // Проверка глубины вложенности (максимум 6 уровней)
  const maxDepth = getMaxDepth(root);
  if (maxDepth > 6) {
    return false;
  }

  // Рекурсивная валидация контейнеров
  function validateZone(zone: Zone, _parentDirection?: SplitDirection): boolean {
    if (zone.type === 'workspace') {
      // Workspace зона должна иметь валидный размер
      if (zone.size < 0 || zone.size > 100) {
        return false;
      }
      return true;
    }

    // Контейнер должен иметь хотя бы 2 зоны
    if (zone.zones.length < 2) {
      return false;
    }

    // Контейнер не должен иметь больше 10 зон
    if (zone.zones.length > 10) {
      return false;
    }

    // Размеры должны суммироваться до 100% (с небольшой погрешностью)
    const totalSize = zone.sizes.reduce((sum, size) => sum + size, 0);
    if (Math.abs(totalSize - 100) > 0.01) {
      return false;
    }

    // Количество размеров должно совпадать с количеством зон
    if (zone.sizes.length !== zone.zones.length) {
      return false;
    }

    // Проверка минимального размера
    const minSize = zone.direction === 'horizontal' ? containerWidth : containerHeight;
    const minPercent = calculateMinSizePercent(minSize);

    for (const size of zone.sizes) {
      if (size < minPercent) {
        return false;
      }
    }

    // Рекурсивная валидация дочерних зон
    for (const child of zone.zones) {
      if (!validateZone(child, zone.direction)) {
        return false;
      }
    }

    return true;
  }

  return validateZone(root);
}

/**
 * Удаление пустых контейнеров (если в контейнере только 1 элемент)
 * @param root - корневая зона для обработки
 * @returns очищенная зона
 */
export function cleanupContainers(root: Zone): Zone {
  if (root.type === 'workspace') {
    return root;
  }

  // Если контейнер содержит только 1 зону, заменить контейнер на его содержимое
  if (root.zones.length === 1) {
    const child = cleanupContainers(root.zones[0]);
    return child;
  }

  // Рекурсивно очистить дочерние зоны
  const cleanedZones = root.zones.map((zone) => cleanupContainers(zone));

  // Если после очистки осталась только 1 зона, вернуть её
  if (cleanedZones.length === 1) {
    return cleanedZones[0];
  }

  // Вернуть контейнер с очищенными зонами
  return {
    ...root,
    zones: cleanedZones,
  };
}
