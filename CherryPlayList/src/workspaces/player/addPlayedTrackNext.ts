import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';
import {
  isProjectGroup,
  isProjectTrack,
  type ProjectGroupSettings,
  type ProjectItem,
  type ProjectTrackSettings,
} from '@core/types/project';
import type { Track } from '@core/types/track';
import { AddItemsAtPositionsCommand } from '@shared/commands';
import { useProjectStore } from '@shared/stores';
import { useGlobalHistoryStore } from '@shared/stores/globalHistoryStore';
import { v4 as uuidv4 } from 'uuid';

let lastAnchorKey: string | null = null;
let lastInsertedItemId: string | null = null;
let lastProjectKey: string | null = null;

const getParentItems = (items: ProjectItem[], parentId: string | null): ProjectItem[] | null => {
  if (parentId === null) {
    return items;
  }
  const parent = findItemById(items, parentId);
  return parent && isProjectGroup(parent) ? parent.items : null;
};

const findItemById = (items: ProjectItem[], itemId: string): ProjectItem | null => {
  for (const item of items) {
    if (item.id === itemId) {
      return item;
    }
    if (isProjectGroup(item)) {
      const nestedItem = findItemById(item.items, itemId);
      if (nestedItem) {
        return nestedItem;
      }
    }
  }
  return null;
};

const resetInsertCursorIfProjectChanged = (projectKey: string) => {
  if (lastProjectKey !== projectKey) {
    lastAnchorKey = null;
    lastInsertedItemId = null;
    lastProjectKey = projectKey;
  }
};

const resolveInsertSlot = (
  items: ProjectItem[],
  getItemPath: (id: string) => string[],
  activeTrackId: string | null,
): { parentId: string | null; parentPath: string[]; insertIndex: number; anchorKey: string } | null => {
  const activePath = activeTrackId ? getItemPath(activeTrackId) : [];
  const activePathExists = Boolean(activeTrackId && activePath.length > 0);
  const anchorKey = activePath[activePath.length - 1] ?? 'queue-start';
  const anchorPath = activePathExists ? activePath : [];
  const parentId =
    activePathExists && anchorPath.length > 1 ? anchorPath[anchorPath.length - 2] : null;
  const parentItems = getParentItems(items, parentId);
  if (!parentItems) {
    return null;
  }

  const anchorIndex = activePathExists
    ? parentItems.findIndex((item) => item.id === activeTrackId)
    : -1;
  if (activePathExists && anchorIndex === -1) {
    return null;
  }

  let insertIndex = activePathExists ? anchorIndex + 1 : 0;
  if (lastAnchorKey === anchorKey && lastInsertedItemId) {
    const lastInsertedPath = getItemPath(lastInsertedItemId);
    const lastInsertedParentId =
      lastInsertedPath.length > 1 ? lastInsertedPath[lastInsertedPath.length - 2] : null;
    const lastInsertedIndex = parentItems.findIndex((item) => item.id === lastInsertedItemId);
    if (lastInsertedParentId === parentId && lastInsertedIndex >= insertIndex) {
      insertIndex = lastInsertedIndex + 1;
    }
  }

  return {
    parentId,
    parentPath: activePathExists ? activePath.slice(0, -1) : [],
    insertIndex,
    anchorKey,
  };
};

const cloneTrackDuplicate = (source: Track): Track => ({
  id: uuidv4(),
  path: source.path,
  name: source.name,
  duration: source.duration,
  isMissing: source.isMissing,
  loudness: source.loudness ? { ...source.loudness } : undefined,
});

const cloneItemTreeWithNewIds = (
  item: ProjectItem,
  sourceTrackSettings: Map<string, ProjectTrackSettings>,
  sourceGroupSettings: Map<string, ProjectGroupSettings>,
  copiedTrackSettings: Map<string, ProjectTrackSettings>,
  copiedGroupSettings: Map<string, ProjectGroupSettings>,
): ProjectItem => {
  if (isProjectGroup(item)) {
    const newId = uuidv4();
    const groupSettings = sourceGroupSettings.get(item.id);
    if (groupSettings) {
      copiedGroupSettings.set(newId, { ...groupSettings });
    }
    return {
      id: newId,
      name: item.name,
      items: item.items.map((child) =>
        cloneItemTreeWithNewIds(
          child,
          sourceTrackSettings,
          sourceGroupSettings,
          copiedTrackSettings,
          copiedGroupSettings,
        ),
      ),
    };
  }

  const duplicate = cloneTrackDuplicate(item);
  const trackSettings = sourceTrackSettings.get(item.id);
  if (trackSettings) {
    copiedTrackSettings.set(duplicate.id, { ...trackSettings });
  }
  return duplicate;
};

export function addPlayedTrackNext(trackId: string, activeTrackId: string | null): boolean {
  const store = useProjectStore.getState();
  const projectKey = `${store.name}:${store.meta.filePath ?? ''}:${store.sessionState.sessionStartTime ?? ''}`;
  resetInsertCursorIfProjectChanged(projectKey);

  const source = store.findItemById(trackId);
  if (!source || !isProjectTrack(source)) {
    return false;
  }

  const slot = resolveInsertSlot(store.items, store.getItemPath, activeTrackId);
  if (!slot) {
    return false;
  }

  const duplicate = cloneTrackDuplicate(source);
  const sourceTrackSettings = store.trackSettings.get(trackId);
  const addedTrackSettings = sourceTrackSettings
    ? new Map([[duplicate.id, { ...sourceTrackSettings }]])
    : undefined;

  const command = new AddItemsAtPositionsCommand(
    [
      {
        item: duplicate,
        parentPath: slot.parentPath,
        index: slot.insertIndex,
      },
    ],
    addedTrackSettings ? { trackSettings: addedTrackSettings } : undefined,
  );
  const result = command.execute({
    items: store.items,
    name: store.name,
    trackSettings: store.trackSettings,
    groupSettings: store.groupSettings,
  });
  if (!result.success || !result.newState?.items) {
    return false;
  }

  useGlobalHistoryStore
    .getState()
    .pushCommand(DEFAULT_PLAYLIST_WORKSPACE_ID, command, `Add "${duplicate.name}" next`);
  useProjectStore.setState({
    ...result.newState,
    meta: { ...store.meta, isDirty: true },
  });

  lastAnchorKey = slot.anchorKey;
  lastInsertedItemId = duplicate.id;
  return true;
}

export function addPlayedGroupNext(groupId: string, activeTrackId: string | null): boolean {
  const store = useProjectStore.getState();
  const projectKey = `${store.name}:${store.meta.filePath ?? ''}:${store.sessionState.sessionStartTime ?? ''}`;
  resetInsertCursorIfProjectChanged(projectKey);

  const source = store.findItemById(groupId);
  if (!source || !isProjectGroup(source)) {
    return false;
  }

  const slot = resolveInsertSlot(store.items, store.getItemPath, activeTrackId);
  if (!slot) {
    return false;
  }

  const copiedTrackSettings = new Map<string, ProjectTrackSettings>();
  const copiedGroupSettings = new Map<string, ProjectGroupSettings>();
  const duplicate = cloneItemTreeWithNewIds(
    source,
    store.trackSettings,
    store.groupSettings,
    copiedTrackSettings,
    copiedGroupSettings,
  );

  const command = new AddItemsAtPositionsCommand(
    [
      {
        item: duplicate,
        parentPath: slot.parentPath,
        index: slot.insertIndex,
      },
    ],
    {
      trackSettings: copiedTrackSettings.size > 0 ? copiedTrackSettings : undefined,
      groupSettings: copiedGroupSettings.size > 0 ? copiedGroupSettings : undefined,
    },
  );
  const result = command.execute({
    items: store.items,
    name: store.name,
    trackSettings: store.trackSettings,
    groupSettings: store.groupSettings,
  });
  if (!result.success || !result.newState?.items) {
    return false;
  }

  useGlobalHistoryStore
    .getState()
    .pushCommand(DEFAULT_PLAYLIST_WORKSPACE_ID, command, `Add group "${source.name}" next`);
  useProjectStore.setState({
    ...result.newState,
    meta: { ...store.meta, isDirty: true },
  });

  lastAnchorKey = slot.anchorKey;
  lastInsertedItemId = duplicate.id;
  return true;
}
