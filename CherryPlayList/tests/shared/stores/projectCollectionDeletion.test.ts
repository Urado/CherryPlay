import { WorkspaceZone } from '../../../src/core/types/layout';
import { useLayoutStore } from '../../../src/shared/stores/layoutStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { getProjectStore, initializeGlobalHistory } from '../../../src/shared/stores/projectStoreFactory';
import { useUIStore } from '../../../src/shared/stores/uiStore';
import { deleteCollectionAndReinitialize, prepareWorkspaceInstance } from '../../../src/shared/utils/workspaceLifecycle';

const collectionZone = (workspaceId: string): WorkspaceZone => ({
  id: `zone-${workspaceId}`,
  type: 'workspace',
  workspaceId,
  workspaceType: 'collection',
  size: 100,
});

const setActiveCollectionLayout = (workspaceIds: string[]): void => {
  const zones = workspaceIds.map(collectionZone);
  useLayoutStore.setState({
    layout: {
      version: 1,
      rootZone: zones.length === 1
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

const loadProjectWithCollections = (ids: string[]): void => {
  useProjectStore.getState().loadProject({
    name: 'Project',
    items: [],
    settings: useProjectStore.getState().settings,
    trackSettings: new Map(),
    groupSettings: new Map(),
    collections: ids.map((id) => ({ id, name: `Подборка ${id}`, items: [] })),
  });
};

describe('project collection deletion', () => {
  beforeAll(async () => {
    await useProjectStore.persist.rehydrate();
  });

  beforeEach(() => {
    initializeGlobalHistory();
    useProjectStore.getState().newProject();
    useUIStore.setState({ workspaces: [] });
    setActiveCollectionLayout([]);
  });

  afterEach(() => {
    useProjectStore.getState().newProject();
    useUIStore.setState({ workspaces: [] });
    setActiveCollectionLayout([]);
  });

  it('reinitializes every active window attached to the deleted collection', () => {
    loadProjectWithCollections(['removed', 'available-one', 'available-two']);
    setActiveCollectionLayout(['window-one', 'window-two']);
    useProjectStore.getState().bindCollectionToWorkspace('window-one', 'removed');
    useProjectStore.getState().bindCollectionToWorkspace('window-two', 'removed');
    prepareWorkspaceInstance(collectionZone('window-one'));
    prepareWorkspaceInstance(collectionZone('window-two'));
    const removedStore = getProjectStore('window-one');
    removedStore?.setState({ items: [{ id: 'old-track', path: 'D:/old.mp3', name: 'Old' }] });

    deleteCollectionAndReinitialize('removed');

    const state = useProjectStore.getState();
    expect(state.collections.map(({ id }) => id)).toEqual(['available-one', 'available-two']);
    expect(state.collectionBindings).toEqual({
      'window-one': 'available-one',
      'window-two': 'available-two',
    });
    expect(getProjectStore('window-one')).not.toBe(removedStore);
    expect(getProjectStore('window-two')).not.toBe(removedStore);
    expect(getProjectStore('window-one')?.getState().items).toEqual([]);
    expect(getProjectStore('window-two')?.getState().items).toEqual([]);
    expect(useUIStore.getState().getWorkspace('window-one')?.name).toBe('Подборка available-one');
    expect(useUIStore.getState().getWorkspace('window-two')?.name).toBe('Подборка available-two');
  });

  it('creates a new collection for every affected window when no free collection remains', () => {
    loadProjectWithCollections(['removed']);
    setActiveCollectionLayout(['window-one', 'window-two']);
    useProjectStore.getState().bindCollectionToWorkspace('window-one', 'removed');
    useProjectStore.getState().bindCollectionToWorkspace('window-two', 'removed');
    prepareWorkspaceInstance(collectionZone('window-one'));
    prepareWorkspaceInstance(collectionZone('window-two'));

    deleteCollectionAndReinitialize('removed');

    const state = useProjectStore.getState();
    expect(state.collections.map(({ name }) => name)).toEqual(['Подборка 1', 'Подборка 2']);
    expect(new Set(Object.values(state.collectionBindings)).size).toBe(2);
    expect(state.meta.isDirty).toBe(true);
  });

  it('does not reinitialize unrelated windows when deleting an unattached collection', () => {
    loadProjectWithCollections(['attached', 'unattached']);
    setActiveCollectionLayout(['window-one']);
    useProjectStore.getState().bindCollectionToWorkspace('window-one', 'attached');
    prepareWorkspaceInstance(collectionZone('window-one'));
    const attachedStore = getProjectStore('window-one');

    deleteCollectionAndReinitialize('unattached');

    expect(getProjectStore('window-one')).toBe(attachedStore);
    expect(useProjectStore.getState().collections.map(({ id }) => id)).toEqual(['attached']);
    expect(useProjectStore.getState().collectionBindings).toEqual({ 'window-one': 'attached' });
  });
});
