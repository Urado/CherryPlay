import { WorkspaceId } from '../../modules/dragDrop/types';

/**
 * Тип зоны: может быть либо контейнером, либо листовым компонентом
 */
export type ZoneType = 'container' | 'workspace';

/**
 * Направление разделения контейнера
 */
export type SplitDirection = 'horizontal' | 'vertical';

/**
 * Идентификатор зоны (UUID)
 */
export type ZoneId = string;

/**
 * Листовая зона (содержит workspace компонент)
 */
export interface WorkspaceZone {
  id: ZoneId;
  type: 'workspace';
  workspaceId: WorkspaceId;
  workspaceType: string; // 'playlist', 'fileBrowser', etc.
  size: number; // процент от родителя (0-100)
}

/**
 * Контейнерная зона (содержит другие зоны)
 */
export interface ContainerZone {
  id: ZoneId;
  type: 'container';
  direction: SplitDirection;
  zones: Zone[]; // рекурсивная структура
  sizes: number[]; // проценты для каждой зоны (сумма = 100)
}

/**
 * Union тип для зоны
 */
export type Zone = WorkspaceZone | ContainerZone;

/**
 * Корневой layout
 */
export interface Layout {
  rootZone: Zone;
  version: number; // для миграций в будущем
}
