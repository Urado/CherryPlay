import { useProjectStore } from '../../../src/shared/stores/projectStore';

const loadProjectWithCollections = (
  name: string,
  collections: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; path: string; name: string }>;
  }>,
  bindings: Record<string, string>,
): void => {
  const state = useProjectStore.getState();
  state.loadProject({
    name,
    items: [],
    settings: state.settings,
    trackSettings: new Map(),
    groupSettings: new Map(),
    collections,
    collectionViewState: { bindings },
  });
};

describe('project collection reset and switch lifecycle', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('clears collection data and workspace bindings when starting a new project', () => {
    const collectionId = useProjectStore.getState().createCollection('Previous project');
    useProjectStore.getState().updateCollection(collectionId, {
      name: 'Previous project',
      items: [{ id: 'old-track', path: 'D:/music/old.mp3', name: 'Old track' }],
    });
    useProjectStore.getState().bindCollectionToWorkspace('old-window', collectionId);

    useProjectStore.getState().newProject();

    expect(useProjectStore.getState().collections).toEqual([]);
    expect(useProjectStore.getState().collectionBindings).toEqual({});
  });

  it('replaces previous project collections and bindings when loading another project', () => {
    const previousCollectionId = useProjectStore.getState().createCollection('Previous project');
    useProjectStore.getState().bindCollectionToWorkspace('previous-window', previousCollectionId);
    const nextCollection = {
      id: 'next-project-collection',
      name: 'Next project',
      items: [{ id: 'next-track', path: 'D:/music/next.mp3', name: 'Next track' }],
    };

    loadProjectWithCollections('Next project', [nextCollection], {
      'next-window': nextCollection.id,
    });

    expect(useProjectStore.getState().collections).toEqual([nextCollection]);
    expect(useProjectStore.getState().collectionBindings).toEqual({
      'next-window': nextCollection.id,
    });
  });
});
