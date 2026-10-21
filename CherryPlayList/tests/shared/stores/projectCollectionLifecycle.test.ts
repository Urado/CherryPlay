import { act, renderHook } from '@testing-library/react';

import { WorkspaceZone } from '../../../src/core/types/layout';
import { useDragDropExecutor } from '../../../src/shared/hooks/useDragDropExecutor';
import { useGlobalHistoryStore } from '../../../src/shared/stores/globalHistoryStore';
import { useLayoutStore } from '../../../src/shared/stores/layoutStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import {
  ensureCollectionWorkspaceStore,
  getProjectStore,
  getStableWorkspaceId,
  initializeGlobalHistory,
} from '../../../src/shared/stores/projectStoreFactory';
import { useUIStore } from '../../../src/shared/stores/uiStore';
import { cleanupWorkspaceInstance, prepareWorkspaceInstance } from '../../../src/shared/utils/workspaceLifecycle';

const collectionZone = (workspaceId: string): WorkspaceZone => ({
  id: `zone-${workspaceId}`,
  type: 'workspace',
  workspaceId,
  workspaceType: 'collection',
  size: 100,
});

const loadProjectWithCollections = (collectionIds: string[]): void => {
  useProjectStore.getState().loadProject({
    name: 'Project',
    items: [],
    settings: useProjectStore.getState().settings,
    trackSettings: new Map(),
    groupSettings: new Map(),
    collections: collectionIds.map((id) => ({ id, name: `Collection ${id}`, items: [] })),
  });
};

const setActiveCollectionLayout = (workspaceIds: string[]): void => {
  const zones = workspaceIds.map(collectionZone);
  useLayoutStore.setState({
    layout: {
      version: 1,
      rootZone:
        zones.length === 1
          ? zones[0]
          : {
              id: 'collection-layout-root',
              type: 'container',
              direction: 'horizontal',
              zones,
              sizes: zones.map(() => 100 / zones.length),
            },
    },
  });
};

describe('project collection workspace lifecycle', () => {
  beforeAll(async () => {
    await useProjectStore.persist.rehydrate();
  });

  beforeEach(() => {
    initializeGlobalHistory();
    useProjectStore.getState().newProject();
    useProjectStore.getState().markLegacyCollectionsMigrationComplete();
    useUIStore.setState({ workspaces: [] });
    setActiveCollectionLayout([]);
    useGlobalHistoryStore.getState().clearHistory();
  });

  afterEach(() => {
    useProjectStore.getState().newProject();
    useUIStore.setState({ workspaces: [] });
    setActiveCollectionLayout([]);
    useGlobalHistoryStore.getState().clearHistory();
  });

  it('assigns the first unused collection, retains it on close, and allows explicit shared binding', () => {
    loadProjectWithCollections(['one', 'two']);
    const firstZone = collectionZone('window-one');
    const secondZone = collectionZone('window-two');
    setActiveCollectionLayout(['window-one', 'window-two']);
    prepareWorkspaceInstance(firstZone);
    prepareWorkspaceInstance(firstZone);
    prepareWorkspaceInstance(secondZone);

    expect(useProjectStore.getState().collectionBindings).toEqual({
      'window-one': 'one',
      'window-two': 'two',
    });
    expect(useProjectStore.getState().meta.isDirty).toBe(false);

    cleanupWorkspaceInstance(firstZone);
    expect(useProjectStore.getState().collections.map(({ id }) => id)).toEqual(['one', 'two']);
    setActiveCollectionLayout(['window-two', 'window-three']);
    prepareWorkspaceInstance(collectionZone('window-three'));
    expect(useProjectStore.getState().collectionBindings['window-three']).toBe('one');

    useProjectStore.getState().bindCollectionToWorkspace('window-four', 'two');
    setActiveCollectionLayout(['window-two', 'window-three', 'window-four']);
    prepareWorkspaceInstance(collectionZone('window-four'));
    expect(getProjectStore('window-four')).toBe(getProjectStore('window-two'));
    expect(useProjectStore.getState().meta.isDirty).toBe(false);
  });

  it('creates and dirties a default-named collection when a project has none', () => {
    useProjectStore.getState().newProject();
    useProjectStore.getState().resetDirty();
    setActiveCollectionLayout(['first-window']);

    prepareWorkspaceInstance(collectionZone('first-window'));

    expect(useProjectStore.getState().collections[0]?.name).toBe('Подборка 1');
    expect(useProjectStore.getState().meta.isDirty).toBe(true);
    expect(useProjectStore.getState().collectionBindings['first-window']).toBe(
      useProjectStore.getState().collections[0]?.id,
    );
  });

  it('reconciles repeated preparation for two visible windows without phantom collections', () => {
    useProjectStore.getState().newProject();
    const firstWindow = collectionZone('startup-window-one');
    const secondWindow = collectionZone('startup-window-two');
    setActiveCollectionLayout(['startup-window-one', 'startup-window-two']);

    prepareWorkspaceInstance(firstWindow);
    prepareWorkspaceInstance(firstWindow);
    prepareWorkspaceInstance(secondWindow);
    prepareWorkspaceInstance(secondWindow);

    expect(useProjectStore.getState().collections.map(({ name }) => name)).toEqual([
      'Подборка 1',
      'Подборка 2',
    ]);
    expect(useProjectStore.getState().collectionBindings).toEqual({
      'startup-window-one': useProjectStore.getState().collections[0]?.id,
      'startup-window-two': useProjectStore.getState().collections[1]?.id,
    });
  });

  it('reuses the first collection when previous bindings belong to inactive windows', () => {
    loadProjectWithCollections(['one', 'two', 'three']);
    useProjectStore.getState().bindCollectionToWorkspace('closed-window-a', 'one');
    useProjectStore.getState().bindCollectionToWorkspace('closed-window-b', 'two');
    setActiveCollectionLayout(['current-window']);

    prepareWorkspaceInstance(collectionZone('current-window'));

    expect(useProjectStore.getState().collectionBindings['current-window']).toBe('one');
    expect(useProjectStore.getState().collections).toHaveLength(3);
  });

  it('keeps collection edits and undo identity stable across rebinding and close', () => {
    loadProjectWithCollections(['stable-id']);
    const originalBinding = collectionZone('window-original');
    setActiveCollectionLayout(['window-original']);
    prepareWorkspaceInstance(originalBinding);
    const adapter = getProjectStore('window-original');
    expect(adapter).toBeDefined();
    adapter?.getState().setName('Renamed');

    expect(useProjectStore.getState().collections[0]?.name).toBe('Renamed');
    expect(useProjectStore.getState().meta.isDirty).toBe(true);
    expect(useGlobalHistoryStore.getState().getLastAction()?.parts[0]?.workspaceId).toBe('stable-id');
    cleanupWorkspaceInstance(originalBinding);
    setActiveCollectionLayout(['window-rebound']);
    prepareWorkspaceInstance(collectionZone('window-rebound'));
    expect(getStableWorkspaceId('window-rebound')).toBe('stable-id');
    expect(useGlobalHistoryStore.getState().undo()).toBe(true);
    expect(useProjectStore.getState().collections[0]?.name).toBe('Collection stable-id');
  });

  it('treats drags between two windows of the same collection as one-list moves', () => {
    loadProjectWithCollections(['shared-list']);
    const firstWindow = collectionZone('window-a');
    const secondWindow = collectionZone('window-b');
    setActiveCollectionLayout(['window-a', 'window-b']);
    prepareWorkspaceInstance(firstWindow);
    useProjectStore.getState().bindCollectionToWorkspace('window-b', 'shared-list');
    prepareWorkspaceInstance(secondWindow);
    const store = getProjectStore('window-a');
    store?.setState({
      items: [
        { id: 'first', path: 'D:/first.mp3', name: 'First' },
        { id: 'second', path: 'D:/second.mp3', name: 'Second' },
      ],
    });
    const { result } = renderHook(() => useDragDropExecutor());

    act(() => {
      expect(result.current.executeMove({
        type: 'move',
        itemIds: ['first'],
        sourceWorkspaceId: 'window-a',
        targetWorkspaceId: 'window-b',
        targetParentId: null,
        targetIndex: 2,
      })).toBe(true);
    });

    expect(getProjectStore('window-a')?.getState().items.map(({ id }) => id)).toEqual([
      'second',
      'first',
    ]);
    expect(useProjectStore.getState().collections[0]?.items.map(({ id }) => id)).toEqual([
      'second',
      'first',
    ]);
  });

  it('removes selected items in one history action so one undo restores all of them', () => {
    loadProjectWithCollections(['bulk-remove']);
    setActiveCollectionLayout(['bulk-window']);
    prepareWorkspaceInstance(collectionZone('bulk-window'));
    const store = getProjectStore('bulk-window');
    store?.setState({
      items: [
        { id: 'remove-a', path: 'D:/a.mp3', name: 'A' },
        { id: 'remove-b', path: 'D:/b.mp3', name: 'B' },
      ],
    });
    useGlobalHistoryStore.getState().clearHistory();

    store?.getState().removeItemsWithHistory(['remove-a', 'remove-b']);

    expect(store?.getState().items).toEqual([]);
    expect(useGlobalHistoryStore.getState().history).toHaveLength(1);
    expect(useGlobalHistoryStore.getState().getLastAction()?.parts).toHaveLength(1);
    expect(useGlobalHistoryStore.getState().undo()).toBe(true);
    expect(store?.getState().items.map(({ id }) => id)).toEqual(['remove-a', 'remove-b']);
    expect(useProjectStore.getState().collections[0]?.items.map(({ id }) => id)).toEqual([
      'remove-a',
      'remove-b',
    ]);
  });

  it('prevents a detached adapter from restoring data into a newly loaded project with the same ID', () => {
    loadProjectWithCollections(['shared-id']);
    const staleAdapter = ensureCollectionWorkspaceStore('old-window', 'shared-id');
    loadProjectWithCollections(['shared-id']);
    staleAdapter.getState().setName('Stale project data');

    expect(useProjectStore.getState().collections[0]?.name).toBe('Collection shared-id');
  });
});
