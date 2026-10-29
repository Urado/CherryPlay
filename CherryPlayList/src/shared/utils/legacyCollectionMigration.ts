import type { StorageValue } from 'zustand/middleware';

import { electronStorage } from '../storage/electronStorage';
import { useProjectStore } from '../stores/projectStore';

let migrationTask: Promise<void> | null = null;
const failedWorkspaceIds = new Set<string>();

const isStoredCollection = (
  value: unknown,
): value is { name: string; items: import('@core/types/project').ProjectItem[] } => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { name?: unknown; items?: unknown };
  return typeof candidate.name === 'string' && Array.isArray(candidate.items);
};

export const migrateLegacyCollections = (): Promise<void> => {
  if (migrationTask) return migrationTask;
  migrationTask = (async () => {
    const projectStore = useProjectStore.getState();
    if (projectStore.legacyCollectionsMigrationComplete) return;
    if (projectStore.meta.filePath) {
      projectStore.markLegacyCollectionsMigrationComplete();
      return;
    }

    const [{ useLayoutStore }, { collectWorkspaceZones }] = await Promise.all([
      import('../stores/layoutStore'),
      import('./layoutWorkspaceOperations'),
    ]);
    if (
      useProjectStore.getState().legacyCollectionsMigrationComplete ||
      useProjectStore.getState().meta.filePath
    ) return;
    const layoutState = useLayoutStore.getState();
    const workspaceIds = new Set<string>();
    const addLayout = (layout: typeof layoutState.layout): void => {
      for (const zone of collectWorkspaceZones(layout.rootZone)) {
        if (zone.workspaceType === 'collection') workspaceIds.add(zone.workspaceId);
      }
    };
    addLayout(layoutState.layout);
    layoutState.userWorkspaces.forEach((workspace) => addLayout(workspace.layout));
    Object.values(layoutState.builtinLayoutOverrides).forEach(addLayout);
    for (const workspaceId of failedWorkspaceIds) {
      if (!workspaceIds.has(workspaceId)) failedWorkspaceIds.delete(workspaceId);
    }

    for (const workspaceId of workspaceIds) {
      const currentProject = useProjectStore.getState();
      if (currentProject.legacyCollectionsMigrationComplete || currentProject.meta.filePath) break;
      const existingCollectionId = currentProject.collectionBindings[workspaceId];
      if (existingCollectionId && !failedWorkspaceIds.has(workspaceId)) continue;
      let stored: StorageValue<unknown> | null;
      try {
        stored = await electronStorage.getItem(`cherryplaylist-${workspaceId}`);
        failedWorkspaceIds.delete(workspaceId);
      } catch (error) {
        failedWorkspaceIds.add(workspaceId);
        console.error(`Failed to read legacy collection for workspace "${workspaceId}":`, error);
        continue;
      }
      const currentState = useProjectStore.getState();
      if (currentState.legacyCollectionsMigrationComplete || currentState.meta.filePath) break;
      const legacyState = stored?.state;
      if (!isStoredCollection(legacyState)) continue;
      const boundCollection = currentState.collections.find(
        (collection) => collection.id === existingCollectionId,
      );
      const collectionId = boundCollection?.id ?? currentState.createCollection(legacyState.name);
      useProjectStore.getState().updateCollection(collectionId, {
        name: legacyState.name,
        items: legacyState.items,
      });
      useProjectStore.getState().bindCollectionToWorkspace(workspaceId, collectionId);
    }

    if (failedWorkspaceIds.size === 0) {
      useProjectStore.getState().markLegacyCollectionsMigrationComplete();
    }
  })().finally(() => {
    migrationTask = null;
  });
  return migrationTask;
};
