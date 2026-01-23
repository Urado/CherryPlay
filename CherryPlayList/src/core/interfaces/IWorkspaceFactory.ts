import { WorkspaceId, WorkspaceType } from '../../modules/dragDrop/types';

import { IWorkspaceStore } from './IWorkspaceStore';

/**
 * Опции для создания workspace
 */
export interface WorkspaceFactoryOptions {
  workspaceId: WorkspaceId;
  workspaceType: WorkspaceType;
  initialName?: string;
  [key: string]: unknown; // Дополнительные опции для специфичных модулей
}

/**
 * Интерфейс фабрики для создания workspace stores
 */
export interface IWorkspaceFactory {
  /**
   * Создать store для workspace
   * @param options Опции для создания
   * @returns Store для workspace
   */
  createStore<T = unknown>(options: WorkspaceFactoryOptions): IWorkspaceStore<T>;

  /**
   * Получить существующий store
   * @param workspaceId Идентификатор workspace
   * @returns Store или undefined, если не найден
   */
  getStore<T = unknown>(workspaceId: WorkspaceId): IWorkspaceStore<T> | undefined;

  /**
   * Удалить store
   * @param workspaceId Идентификатор workspace
   */
  removeStore(workspaceId: WorkspaceId): void;
}
