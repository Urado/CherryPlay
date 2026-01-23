import React from 'react';

import { IWorkspaceModule, IWorkspaceModuleRegistry } from '../interfaces';
import { WorkspaceId } from '../types/workspace';

/**
 * Реестр модулей workspace
 * Управляет регистрацией и получением модулей для динамической загрузки
 */
class WorkspaceRegistry implements IWorkspaceModuleRegistry {
  private modules = new Map<WorkspaceId, IWorkspaceModule>();
  private modulesByType = new Map<string, IWorkspaceModule>();

  register(module: IWorkspaceModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`Workspace module with ID ${module.id} already registered. Overwriting.`);
    }
    if (this.modulesByType.has(module.type)) {
      console.warn(`Workspace module with type ${module.type} already registered. Overwriting.`);
    }
    this.modules.set(module.id, module);
    this.modulesByType.set(module.type, module);
  }

  unregister(id: WorkspaceId): void {
    const module = this.modules.get(id);
    if (module) {
      this.modules.delete(id);
      this.modulesByType.delete(module.type);
    }
  }

  getModule(id: WorkspaceId): IWorkspaceModule | undefined {
    return this.modules.get(id);
  }

  getModuleByType(type: string): IWorkspaceModule | undefined {
    return this.modulesByType.get(type);
  }

  renderWorkspace(workspaceId: WorkspaceId, zoneId: string): React.ReactNode {
    // First try to get by ID (for specific workspaces like playlist)
    const module = this.modules.get(workspaceId);

    // If not found by ID, try to get by type from the zone's workspaceType
    // This requires passing workspaceType, but for now we'll use a fallback
    // The WorkspaceRenderer should pass the type, but we'll handle it here
    if (!module) {
      // For dynamic workspaces, we need to find by type
      // This is a limitation - we need workspaceType in the render call
      // For now, we'll return an error message
      return React.createElement(
        'div',
        { className: 'empty-state' },
        `Unknown workspace module: ${workspaceId}`,
      );
    }

    return React.createElement(module.component, { workspaceId, zoneId });
  }
}

/**
 * Глобальный экземпляр реестра
 */
export const workspaceRegistry = new WorkspaceRegistry();

/**
 * Экспорт типа для удобства
 */
export type { WorkspaceRegistry };
