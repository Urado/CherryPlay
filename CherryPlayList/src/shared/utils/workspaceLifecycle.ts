import { registerWorkspaceType, unregisterWorkspaceType } from '@core/constants/workspace';
import { WorkspaceZone } from '@core/types/layout';

import { ensureProjectStore, removeProjectStore } from '../stores/projectStoreFactory';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';

const COLLECTION_NAME_PREFIX = 'Коллекция ';
const COLLECTION_NAME_PATTERN = /^Коллекция (\d+)$/;

function getNextCollectionNumber(collectionNames: string[]): number {
  let maxNumber = 0;
  let parsedAny = false;

  for (const name of collectionNames) {
    const match = name.match(COLLECTION_NAME_PATTERN);
    if (match) {
      parsedAny = true;
      maxNumber = Math.max(maxNumber, Number.parseInt(match[1], 10));
    }
  }

  if (parsedAny) {
    return maxNumber + 1;
  }

  return collectionNames.length + 1;
}

/** Registers a collection workspace created by layout preset builders (fixed display name). */
export function setupCollectionZoneForPreset(zone: WorkspaceZone, name: string): void {
  const { workspaceId, workspaceType, id: zoneId } = zone;

  ensureProjectStore({
    workspaceId,
    initialName: name,
    persist: true,
    supportsGroups: false,
    maxItems: null,
  });

  registerWorkspaceType(workspaceId, workspaceType);
  const uiStore = useUIStore.getState();
  uiStore.addWorkspace({ id: workspaceId, type: workspaceType, name, zoneId });
  uiStore.setWorkspaceZoneId(workspaceId, zoneId);
}

export function prepareWorkspaceInstance(zone: WorkspaceZone): void {
  const { workspaceId, workspaceType, id: zoneId } = zone;

  if (workspaceType === 'collection') {
    const uiStore = useUIStore.getState();
    const collectionNames = uiStore.workspaces
      .filter((workspace) => workspace.type === 'collection')
      .map((workspace) => workspace.name);
    const name = `${COLLECTION_NAME_PREFIX}${getNextCollectionNumber(collectionNames)}`;

    ensureProjectStore({
      workspaceId,
      initialName: name,
      persist: true,
      supportsGroups: false,
      maxItems: null,
    });

    registerWorkspaceType(workspaceId, workspaceType);
    uiStore.addWorkspace({ id: workspaceId, type: workspaceType, name, zoneId });
    uiStore.setWorkspaceZoneId(workspaceId, zoneId);
    return;
  }

  if (workspaceType === 'fileBrowser') {
    registerWorkspaceType(workspaceId, workspaceType);
    return;
  }

  if (workspaceType.startsWith('test')) {
    registerWorkspaceType(workspaceId, workspaceType);
  }
}

export function cleanupWorkspaceInstance(zone: WorkspaceZone): void {
  if (zone.workspaceType === 'collection') {
    const uiStore = useUIStore.getState();
    uiStore.removeWorkspace(zone.workspaceId);
    removeProjectStore(zone.workspaceId);
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
}
