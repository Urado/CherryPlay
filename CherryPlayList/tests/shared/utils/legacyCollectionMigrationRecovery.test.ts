import type { StorageValue } from 'zustand/middleware';

const mockGetItem = jest.fn<Promise<StorageValue<unknown> | null>, [string]>();

jest.mock('../../../src/shared/storage/electronStorage', () => ({
  electronStorage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import type { Layout, WorkspaceZone } from '../../../src/core/types/layout';
import { useLayoutStore } from '../../../src/shared/stores/layoutStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { migrateLegacyCollections } from '../../../src/shared/utils/legacyCollectionMigration';
import { prepareWorkspaceInstance } from '../../../src/shared/utils/workspaceLifecycle';

const makeZone = (workspaceId: string): WorkspaceZone => ({
  id: `zone-${workspaceId}`,
  type: 'workspace',
  workspaceId,
  workspaceType: 'collection',
  size: 100,
});

const makeLayout = (workspaceId: string): Layout => ({
  version: 1,
  rootZone: makeZone(workspaceId),
});

const makeLegacyValue = (name: string, id: string): StorageValue<unknown> => ({
  state: { name, items: [{ id, path: `D:/music/${id}.mp3`, name: id }] },
  version: 0,
});

describe('legacy collection migration recovery', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
    useProjectStore.setState({ legacyCollectionsMigrationComplete: false });
    mockGetItem.mockReset();
  });

  it('retries a failed workspace read and migrates into its existing empty binding', async () => {
    const workspaceId = 'retry-legacy-window';
    useLayoutStore.setState({
      layout: makeLayout(workspaceId),
      userWorkspaces: [],
      builtinLayoutOverrides: {},
    });
    mockGetItem
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(makeLegacyValue('Recovered', 'recovered-track'));

    await expect(migrateLegacyCollections()).resolves.toBeUndefined();
    expect(useProjectStore.getState().legacyCollectionsMigrationComplete).toBe(false);

    const placeholderId = useProjectStore.getState().createCollection();
    useProjectStore.getState().bindCollectionToWorkspace(workspaceId, placeholderId);
    await migrateLegacyCollections();

    const recovered = useProjectStore
      .getState()
      .collections.find((collection) => collection.id === placeholderId);
    expect(recovered).toEqual({
      id: placeholderId,
      name: 'Recovered',
      items: [
        { id: 'recovered-track', path: 'D:/music/recovered-track.mp3', name: 'recovered-track' },
      ],
    });
    expect(useProjectStore.getState().legacyCollectionsMigrationComplete).toBe(true);
    expect(mockGetItem).toHaveBeenCalledTimes(2);
  });

  it('prepares the collection workspace after a rejected legacy storage read', async () => {
    const workspaceId = 'unavailable-legacy-window';
    useLayoutStore.setState({
      layout: makeLayout(workspaceId),
      userWorkspaces: [],
      builtinLayoutOverrides: {},
    });
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));

    prepareWorkspaceInstance(makeZone(workspaceId));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useProjectStore.getState().collectionBindings[workspaceId]).toBeTruthy();
    expect(useProjectStore.getState().legacyCollectionsMigrationComplete).toBe(false);
  });

  it('reads saved and builtin override layouts while leaving orphan keys untouched', async () => {
    const activeId = 'active-collection-window';
    const savedId = 'saved-collection-window';
    const builtinId = 'builtin-collection-window';
    useLayoutStore.setState({
      layout: makeLayout(activeId),
      userWorkspaces: [{ id: 'saved-workspace', name: 'Saved', layout: makeLayout(savedId) }],
      builtinLayoutOverrides: { simple: makeLayout(builtinId) },
    });
    mockGetItem.mockImplementation((key) => {
      const values: Record<string, StorageValue<unknown>> = {
        [`cherryplaylist-${activeId}`]: makeLegacyValue('Active', 'active-track'),
        [`cherryplaylist-${savedId}`]: makeLegacyValue('Saved collection', 'saved-track'),
        [`cherryplaylist-${builtinId}`]: makeLegacyValue('Builtin override', 'builtin-track'),
      };
      return Promise.resolve(values[key] ?? null);
    });

    await migrateLegacyCollections();

    expect(mockGetItem.mock.calls.map(([key]) => key).sort()).toEqual([
      `cherryplaylist-${activeId}`,
      `cherryplaylist-${builtinId}`,
      `cherryplaylist-${savedId}`,
    ]);
    expect(
      useProjectStore
        .getState()
        .collections.map(({ name }) => name)
        .sort(),
    ).toEqual(['Active', 'Builtin override', 'Saved collection']);
    expect(useProjectStore.getState().legacyCollectionsMigrationComplete).toBe(true);
  });
});
