import type { StorageValue } from 'zustand/middleware';

const mockGetItem = jest.fn<Promise<StorageValue<unknown> | null>, [string]>();

jest.mock('../../../src/shared/storage/electronStorage', () => ({
  electronStorage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { WorkspaceZone } from '../../../src/core/types/layout';
import { useLayoutStore } from '../../../src/shared/stores/layoutStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { migrateLegacyCollections } from '../../../src/shared/utils/legacyCollectionMigration';

const zone: WorkspaceZone = {
  id: 'collection-zone',
  type: 'workspace',
  workspaceId: 'legacy-window',
  workspaceType: 'collection',
  size: 100,
};

const configureLegacyCollectionLayout = (): void => {
  useLayoutStore.setState({
    layout: { rootZone: zone, version: 1 },
    userWorkspaces: [],
    builtinLayoutOverrides: {},
  });
};

describe('legacy collection migration', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
    useProjectStore.setState({ legacyCollectionsMigrationComplete: false });
    configureLegacyCollectionLayout();
    mockGetItem.mockReset();
  });

  it('imports legacy collection data once and leaves the source key available', async () => {
    mockGetItem.mockResolvedValue({
      state: {
        name: 'Legacy set',
        items: [{ id: 'legacy-track', path: 'D:/music/legacy.mp3', name: 'Legacy' }],
      },
      version: 0,
    });

    await migrateLegacyCollections();
    await migrateLegacyCollections();

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    const migratedCollection = useProjectStore.getState().collections[0];
    expect(migratedCollection?.name).toBe('Legacy set');
    expect(migratedCollection?.items).toEqual([
      { id: 'legacy-track', path: 'D:/music/legacy.mp3', name: 'Legacy' },
    ]);
    expect(migratedCollection?.id).toBeTruthy();
    expect(useProjectStore.getState().collectionBindings['legacy-window']).toBe(
      useProjectStore.getState().collections[0]?.id,
    );
  });

  it('does not apply a delayed legacy read to a different project opened meanwhile', async () => {
    let resolveStorage: ((value: StorageValue<unknown> | null) => void) | undefined;
    mockGetItem.mockImplementation(
      () => new Promise((resolve) => { resolveStorage = resolve; }),
    );

    const migration = migrateLegacyCollections();
    await Promise.resolve();
    useProjectStore.getState().newProject();
    resolveStorage?.({
      state: { name: 'Stale legacy data', items: [{ id: 'old', path: 'D:/old.mp3', name: 'Old' }] },
      version: 0,
    });
    await migration;

    expect(useProjectStore.getState().collections).toEqual([]);
    expect(useProjectStore.getState().collectionBindings).toEqual({});
  });

  it('reads the current layout after deferred initialization instead of a stale workspace list', async () => {
    const migration = migrateLegacyCollections();
    useLayoutStore.setState({
      layout: { rootZone: { ...zone, workspaceId: 'other-window' }, version: 1 },
    });
    await migration;

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockGetItem).toHaveBeenCalledWith('cherryplaylist-other-window');
    expect(useProjectStore.getState().collections).toEqual([]);
  });
});
