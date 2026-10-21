import { registerWorkspaceType, unregisterWorkspaceType } from '@core/constants/workspace';
import { WorkspaceZone } from '@core/types/layout';


import { useProjectStore } from '../stores/projectStore';
import {
  ensureCollectionWorkspaceStore,
  removeCollectionWorkspaceStore,
  removeProjectStore,
} from '../stores/projectStoreFactory';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';

import { getActiveLayoutSnapshotForFocus } from './layoutFocusBridge';
import { collectWorkspaceZones } from './layoutWorkspaceOperations';
import { migrateLegacyCollections } from './legacyCollectionMigration';

const prepareCollectionWorkspace = (
  zone: WorkspaceZone,
  activeWorkspaceIds?: ReadonlySet<string>,
): void => {
  const { workspaceId, workspaceType, id: zoneId } = zone;
  const uiStore = useUIStore.getState();
  const projectStore = useProjectStore.getState();
  const existingCollectionId = projectStore.collectionBindings[workspaceId];
  const boundCollection = projectStore.collections.find(
    (collection) => collection.id === existingCollectionId,
  );
  const currentLayout = getActiveLayoutSnapshotForFocus();
  const visibleWorkspaceIds = activeWorkspaceIds ?? new Set([
    ...(currentLayout
      ? collectWorkspaceZones(currentLayout.rootZone)
          .filter((workspace) => workspace.workspaceType === 'collection')
          .map((workspace) => workspace.workspaceId)
      : []),
    workspaceId,
  ]);
  const occupiedCollectionIds = new Set(
    [...visibleWorkspaceIds]
      .filter((visibleWorkspaceId) => visibleWorkspaceId !== workspaceId)
      .map((visibleWorkspaceId) => projectStore.collectionBindings[visibleWorkspaceId])
      .filter((id): id is string => Boolean(id)),
  );
  const freeCollection = projectStore.collections.find(
    (collection) => !occupiedCollectionIds.has(collection.id),
  );
  const collectionId = boundCollection?.id ?? freeCollection?.id ?? projectStore.createCollection();
  const collection = useProjectStore
    .getState()
    .collections.find((entry) => entry.id === collectionId);
  if (!collection) return;
  useProjectStore.getState().bindCollectionToWorkspace(workspaceId, collectionId);
  ensureCollectionWorkspaceStore(workspaceId, collectionId);

  registerWorkspaceType(workspaceId, workspaceType);
  uiStore.addWorkspace({ id: workspaceId, type: workspaceType, name: collection.name, zoneId });
  uiStore.setWorkspaceZoneId(workspaceId, zoneId);
};

export const prepareWorkspaceInstance = (
  zone: WorkspaceZone,
  activeCollectionWorkspaceIds?: ReadonlySet<string>,
): void => {
  const { workspaceId, workspaceType } = zone;

  if (workspaceType === 'collection') {
    if (!useProjectStore.persist.hasHydrated()) return;
    const projectState = useProjectStore.getState();
    if (projectState.legacyCollectionsMigrationComplete || projectState.meta.filePath) {
      if (projectState.meta.filePath && !projectState.legacyCollectionsMigrationComplete) {
        projectState.markLegacyCollectionsMigrationComplete();
      }
      prepareCollectionWorkspace(zone, activeCollectionWorkspaceIds);
    } else {
      void migrateLegacyCollections().then(() =>
        prepareCollectionWorkspace(zone, activeCollectionWorkspaceIds),
      ).catch(() => prepareCollectionWorkspace(zone, activeCollectionWorkspaceIds));
    }
    return;
  }

  if (workspaceType === 'fileBrowser') {
    registerWorkspaceType(workspaceId, workspaceType);
    return;
  }

  if (workspaceType.startsWith('test')) {
    registerWorkspaceType(workspaceId, workspaceType);
  }
};

export const deleteCollectionAndReinitialize = (collectionId: string): void => {
  const activeLayout = getActiveLayoutSnapshotForFocus();
  const affectedZones = activeLayout
    ? collectWorkspaceZones(activeLayout.rootZone).filter(
        (zone) => zone.workspaceType === 'collection'
          && useProjectStore.getState().collectionBindings[zone.workspaceId] === collectionId,
      )
    : [];
  useProjectStore.getState().deleteCollection(collectionId);
  removeCollectionWorkspaceStore(collectionId);
  if (affectedZones.length === 0) return;
  const activeWorkspaceIds = new Set(
    activeLayout
      ? collectWorkspaceZones(activeLayout.rootZone)
          .filter((zone) => zone.workspaceType === 'collection')
          .map((zone) => zone.workspaceId)
      : [],
  );
  affectedZones.forEach((zone) => prepareWorkspaceInstance(zone, activeWorkspaceIds));
};

export const cleanupWorkspaceInstance = (zone: WorkspaceZone): void => {
  if (zone.workspaceType === 'collection') {
    const uiStore = useUIStore.getState();
    uiStore.removeWorkspace(zone.workspaceId);
    removeProjectStore(zone.workspaceId);
    useProjectStore.getState().unbindCollectionFromWorkspace(zone.workspaceId);
    unregisterWorkspaceType(zone.workspaceId);
    return;
  }

  if (zone.workspaceType === 'fileBrowser') {
    useSettingsStore.getState().removeFileBrowserPathForWorkspace(zone.workspaceId);
    unregisterWorkspaceType(zone.workspaceId);
    return;
  }

  if (zone.workspaceType.startsWith('test')) {
    unregisterWorkspaceType(zone.workspaceId);
  }
};
