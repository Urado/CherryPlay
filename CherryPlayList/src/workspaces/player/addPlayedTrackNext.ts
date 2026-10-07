import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';
import { isProjectGroup, isProjectTrack, type ProjectItem } from '@core/types/project';
import type { Track } from '@core/types/track';
import { AddItemsAtPositionsCommand } from '@shared/commands';
import { useProjectStore } from '@shared/stores';
import { useGlobalHistoryStore } from '@shared/stores/globalHistoryStore';
import { v4 as uuidv4 } from 'uuid';

let lastAnchorKey: string | null = null;
let lastInsertedTrackId: string | null = null;
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

export function addPlayedTrackNext(trackId: string, activeTrackId: string | null): boolean {
  const store = useProjectStore.getState();
  const projectKey = `${store.name}:${store.meta.filePath ?? ''}:${store.sessionState.sessionStartTime ?? ''}`;
  if (lastProjectKey !== projectKey) {
    lastAnchorKey = null;
    lastInsertedTrackId = null;
    lastProjectKey = projectKey;
  }
  const source = store.findItemById(trackId);
  if (!source || !isProjectTrack(source)) {
    return false;
  }

  const activePath = activeTrackId ? store.getItemPath(activeTrackId) : [];
  const activePathExists = Boolean(activeTrackId && activePath.length > 0);
  const anchorKey = activePath[activePath.length - 1] ?? 'queue-start';
  const anchorPath = activePathExists ? activePath : [];
  const parentId =
    activePathExists && anchorPath.length > 1 ? anchorPath[anchorPath.length - 2] : null;
  const parentItems = getParentItems(store.items, parentId);
  if (!parentItems) {
    return false;
  }

  const anchorIndex = activePathExists
    ? parentItems.findIndex((item) => item.id === activeTrackId)
    : -1;
  if (activePathExists && anchorIndex === -1) {
    return false;
  }

  let insertIndex = activePathExists ? anchorIndex + 1 : 0;
  if (lastAnchorKey === anchorKey && lastInsertedTrackId) {
    const lastInsertedPath = store.getItemPath(lastInsertedTrackId);
    const lastInsertedParentId =
      lastInsertedPath.length > 1 ? lastInsertedPath[lastInsertedPath.length - 2] : null;
    const lastInsertedIndex = parentItems.findIndex((item) => item.id === lastInsertedTrackId);
    if (lastInsertedParentId === parentId && lastInsertedIndex >= insertIndex) {
      insertIndex = lastInsertedIndex + 1;
    }
  }

  const duplicate: Track = {
    id: uuidv4(),
    path: source.path,
    name: source.name,
    duration: source.duration,
    isMissing: source.isMissing,
    loudness: source.loudness ? { ...source.loudness } : undefined,
  };

  const parentPath = activePathExists ? activePath.slice(0, -1) : [];
  const sourceTrackSettings = store.trackSettings.get(trackId);
  const command = new AddItemsAtPositionsCommand(
    [
      {
        item: duplicate,
        parentPath,
        index: insertIndex,
      },
    ],
    sourceTrackSettings
      ? { trackId: duplicate.id, settings: { ...sourceTrackSettings } }
      : undefined,
  );
  const result = command.execute({
    items: store.items,
    name: store.name,
    trackSettings: store.trackSettings,
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

  lastAnchorKey = anchorKey;
  lastInsertedTrackId = duplicate.id;
  return true;
}
