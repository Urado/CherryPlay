import { StoreApi, UseBoundStore } from 'zustand';

import { WorkspaceId } from '../../modules/dragDrop/types';

/**
 * Базовый интерфейс для store workspace модуля
 * Каждый модуль может иметь свой собственный store или использовать общий
 */
export interface IWorkspaceStore<T = unknown> {
  /**
   * Идентификатор workspace
   */
  workspaceId: WorkspaceId;

  /**
   * Получить текущее состояние store
   */
  getState: () => T;

  /**
   * Подписаться на изменения store
   */
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;

  /**
   * Уничтожить store
   */
  destroy?: () => void;
}

/**
 * Тип для Zustand store
 */
export type WorkspaceStore<T = unknown> = UseBoundStore<StoreApi<T>>;
