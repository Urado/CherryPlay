import type { StorageValue } from 'zustand/middleware';

const legacyEntries = new Map<string, StorageValue<unknown>>();

jest.mock('../../../src/shared/storage/electronStorage', () => ({
  electronStorage: {
    getItem: (key: string) => Promise.resolve(legacyEntries.get(key) ?? null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import type { Layout, WorkspaceZone } from '../../../src/core/types/layout';
import { useLayoutStore } from '../../../src/shared/stores/layoutStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { migrateLegacyCollections } from '../../../src/shared/utils/legacyCollectionMigration';

const activeWorkspaceId = 'known-collection-window';
const activeZone: WorkspaceZone = {
  id: 'known-collection-zone',
  type: 'workspace',
  workspaceId: activeWorkspaceId,
  workspaceType: 'collection',
  size: 100,
};
const activeLayout: Layout = { version: 1, rootZone: activeZone };

describe('legacy orphan collection key preservation', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
    useProjectStore.setState({ legacyCollectionsMigrationComplete: false });
    useLayoutStore.setState({
      layout: activeLayout,
      userWorkspaces: [],
      builtinLayoutOverrides: {},
    });
    legacyEntries.clear();
    legacyEntries.set(`cherryplaylist-${activeWorkspaceId}`, {
      state: { name: 'Known collection', items: [] },
      version: 0,
    });
    legacyEntries.set('cherryplaylist-orphan-window', {
      state: { name: 'Orphan collection', items: [] },
      version: 0,
    });
  });

  it('leaves an orphan key stored and does not read or assign it to a known workspace', async () => {
    await migrateLegacyCollections();

    expect(legacyEntries.has('cherryplaylist-orphan-window')).toBe(true);
    expect(useProjectStore.getState().collections.map((collection) => collection.name)).toEqual([
      'Known collection',
    ]);
    expect(useProjectStore.getState().collectionBindings).toEqual({
      [activeWorkspaceId]: useProjectStore.getState().collections[0]?.id,
    });
  });
});
