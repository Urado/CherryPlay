import { act } from '@testing-library/react';

import type { ContainerZone } from '../../src/core/types/layout';
import { DEFAULT_BUILTIN_PRESET } from '../../src/core/types/workspacePreset';
import { electronStorage } from '../../src/shared/storage/electronStorage';
import {
  computeIsWorkspaceDirty,
  createDefaultWorkspacePersistSlice,
  LEGACY_LAYOUT_PERSIST_KEY,
  migratePersistedWorkspaceState,
  normalizeWorkspacePersistSlice,
  removeLegacyLayoutPersistKey,
  useLayoutStore,
  WORKSPACE_PERSIST_KEY,
} from '../../src/shared/stores/layoutStore';
import { useUIStore } from '../../src/shared/stores/uiStore';
import { getLayoutPresetFromLayout } from '../../src/shared/utils/layoutPreset';
import { getLayoutZoneSignature } from '../../src/shared/utils/layoutSignature';
import { collectWorkspaceZones } from '../../src/shared/utils/layoutWorkspaceOperations';

function getCollectionWorkspaceIds(layout: ReturnType<typeof useLayoutStore.getState>['layout']) {
  return collectWorkspaceZones(layout.rootZone)
    .filter((zone) => zone.workspaceType === 'collection')
    .map((zone) => zone.workspaceId);
}

const resetStore = () => {
  const defaults = createDefaultWorkspacePersistSlice();
  useLayoutStore.setState({
    ...defaults,
    baselineLayout: JSON.parse(JSON.stringify(defaults.layout)) as typeof defaults.layout,
    isLayoutEditMode: false,
    openLayoutEditPickerKey: null,
  });
};

beforeEach(() => {
  resetStore();
});

describe('workspaceStore', () => {
  describe('fresh state', () => {
    it('starts on built-in collections with matching layout signature', () => {
      const state = useLayoutStore.getState();

      expect(state.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(state.userWorkspaces).toEqual([]);
      expect(getLayoutPresetFromLayout(state.layout)).toBe(DEFAULT_BUILTIN_PRESET);
      expect(state.isWorkspaceDirty()).toBe(false);
    });
  });

  describe('normalizeWorkspacePersistSlice', () => {
    it('coerces scratch active workspace to default built-in collections', () => {
      const scratchLayout = useLayoutStore.getState().layout;
      const normalized = normalizeWorkspacePersistSlice({
        activeWorkspace: { kind: 'scratch' },
        userWorkspaces: [],
        layout: scratchLayout,
      });

      expect(normalized.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(getLayoutPresetFromLayout(normalized.layout)).toBe(DEFAULT_BUILTIN_PRESET);
    });

    it('falls back to default built-in when user workspace id is missing', () => {
      const normalized = normalizeWorkspacePersistSlice({
        activeWorkspace: { kind: 'user', id: 'missing-id' },
        userWorkspaces: [],
        layout: useLayoutStore.getState().layout,
      });

      expect(normalized.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(getLayoutPresetFromLayout(normalized.layout)).toBe(DEFAULT_BUILTIN_PRESET);
    });
  });

  describe('migratePersistedWorkspaceState', () => {
    it('resets to collections on version 0', () => {
      const migrated = migratePersistedWorkspaceState(null, 0);

      expect(migrated.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(migrated.userWorkspaces).toEqual([]);
      expect(getLayoutPresetFromLayout(migrated.layout)).toBe(DEFAULT_BUILTIN_PRESET);
    });

    it('preserves valid persisted workspace slice', () => {
      const saved = createDefaultWorkspacePersistSlice();
      const migrated = migratePersistedWorkspaceState(saved, 1);

      expect(migrated.activeWorkspace).toEqual(saved.activeWorkspace);
      expect(migrated.userWorkspaces).toEqual(saved.userWorkspaces);
      expect(getLayoutPresetFromLayout(migrated.layout)).toBe(DEFAULT_BUILTIN_PRESET);
    });

    it('coerces scratch in migrated state', () => {
      const migrated = migratePersistedWorkspaceState(
        {
          activeWorkspace: { kind: 'scratch' },
          userWorkspaces: [],
          layout: useLayoutStore.getState().layout,
        },
        1,
      );

      expect(migrated.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
    });
  });

  describe('removeLegacyLayoutPersistKey', () => {
    it('removes legacy layout key from storage', async () => {
      await electronStorage.setItem(LEGACY_LAYOUT_PERSIST_KEY, {
        state: { layout: { version: 1, rootZone: { id: 'legacy' } } },
        version: 3,
      });

      await removeLegacyLayoutPersistKey();

      const legacyValue = await electronStorage.getItem(LEGACY_LAYOUT_PERSIST_KEY);
      expect(legacyValue).toBeNull();
    });
  });

  describe('workspace actions', () => {
    it('saveCurrentWorkspaceAs creates a user workspace and clears dirty flag', () => {
      act(() => {
        useLayoutStore.getState().setLayoutPreset('simple');
      });

      expect(useLayoutStore.getState().isWorkspaceDirty()).toBe(false);

      act(() => {
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
      });

      expect(useLayoutStore.getState().isWorkspaceDirty()).toBe(true);

      act(() => {
        expect(useLayoutStore.getState().saveCurrentWorkspaceAs('My layout')).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.userWorkspaces).toHaveLength(1);
      expect(state.userWorkspaces[0]?.name).toBe('My layout');
      expect(state.activeWorkspace).toEqual({ kind: 'user', id: state.userWorkspaces[0]?.id });
      expect(state.isWorkspaceDirty()).toBe(false);
    });

    it('saveCurrentWorkspace updates active user workspace layout', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('Saved');
      });

      const userId = useLayoutStore.getState().userWorkspaces[0]?.id;

      act(() => {
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
      });

      expect(useLayoutStore.getState().isWorkspaceDirty()).toBe(true);

      act(() => {
        expect(useLayoutStore.getState().saveCurrentWorkspace()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.isWorkspaceDirty()).toBe(false);
      expect(getLayoutZoneSignature(state.layout.rootZone)).toBe(
        getLayoutZoneSignature(state.userWorkspaces[0]!.layout.rootZone),
      );
      expect(state.activeWorkspace).toEqual({ kind: 'user', id: userId });
    });

    it('saveCurrentWorkspace only updates user workspaces', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('Saved');
        useLayoutStore.getState().setLayoutPreset('player');
      });

      expect(useLayoutStore.getState().saveCurrentWorkspace()).toBe(false);

      act(() => {
        useLayoutStore.getState().activateWorkspace({ kind: 'user', id: 'missing' });
      });

      const userId = useLayoutStore.getState().userWorkspaces[0]?.id;
      act(() => {
        useLayoutStore.getState().activateWorkspace({ kind: 'user', id: userId! });
        useLayoutStore.getState().setLayoutPreset('simple');
      });

      expect(useLayoutStore.getState().saveCurrentWorkspace()).toBe(false);
    });

    it('saveCurrentWorkspaceAsUnnamed creates workspace with default name', () => {
      act(() => {
        useLayoutStore.getState().setLayoutPreset('simple');
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
        expect(useLayoutStore.getState().saveCurrentWorkspaceAsUnnamed()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.userWorkspaces[0]?.name).toBe('Без имени');
      expect(state.activeWorkspace.kind).toBe('user');
      expect(state.isWorkspaceDirty()).toBe(false);
    });

    it('saveCurrentWorkspaceAsUnnamed numbers additional unnamed workspaces', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAsUnnamed();
        useLayoutStore.getState().setLayoutPreset('simple');
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
        expect(useLayoutStore.getState().saveCurrentWorkspaceAsUnnamed()).toBe(true);
      });

      const names = useLayoutStore.getState().userWorkspaces.map((w) => w.name);
      expect(names).toContain('Без имени');
      expect(names).toContain('Без имени 2');
    });

    it('autoCommitWorkspaceChanges upserts builtin override without forking to Мои', () => {
      act(() => {
        useLayoutStore.getState().setLayoutPreset('collections');
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
        expect(useLayoutStore.getState().autoCommitWorkspaceChanges()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.activeWorkspace).toEqual({ kind: 'builtin', preset: 'collections-vertical' });
      expect(state.userWorkspaces).toHaveLength(0);
      expect(state.hasBuiltinOverride('collections-vertical')).toBe(true);
      expect(state.isWorkspaceDirty()).toBe(false);
    });

    it('autoCommitWorkspaceChanges discards size-only builtin edits without override', () => {
      act(() => {
        useLayoutStore.getState().setLayoutPreset('simple');
      });

      const root = useLayoutStore.getState().layout.rootZone;
      expect(root.type).toBe('container');
      const containerId = root.id;
      const originalSizes = root.type === 'container' ? ([...root.sizes] as number[]) : [];

      act(() => {
        useLayoutStore.getState().updateContainerSizes(
          containerId,
          originalSizes.map((size, index) =>
            index === 0 ? Math.max(size - 10, 20) : Math.min(size + 10, 80),
          ),
        );
        expect(useLayoutStore.getState().autoCommitWorkspaceChanges()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.activeWorkspace).toEqual({ kind: 'builtin', preset: 'simple' });
      expect(state.userWorkspaces).toHaveLength(0);
      expect(state.hasBuiltinOverride('simple')).toBe(false);
      expect(state.isWorkspaceDirty()).toBe(false);
      const afterRoot = state.layout.rootZone;
      expect(afterRoot.type).toBe('container');
      if (afterRoot.type === 'container') {
        expect(afterRoot.sizes).toEqual(originalSizes);
      }
    });

    it('autoCommitWorkspaceChanges silently saves user workspace', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('Named');
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
        expect(useLayoutStore.getState().autoCommitWorkspaceChanges()).toBe(true);
      });

      expect(useLayoutStore.getState().isWorkspaceDirty()).toBe(false);
      expect(useLayoutStore.getState().userWorkspaces).toHaveLength(1);
    });

    it('renameUserWorkspace updates workspace name', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('Old name');
      });

      const userId = useLayoutStore.getState().userWorkspaces[0]?.id;

      act(() => {
        expect(useLayoutStore.getState().renameUserWorkspace(userId!, 'New name')).toBe(true);
      });

      expect(useLayoutStore.getState().userWorkspaces[0]?.name).toBe('New name');
    });

    it('resetCurrentWorkspace restores factory built-in layout', () => {
      act(() => {
        useLayoutStore.getState().setLayoutPreset('simple');
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
      });

      expect(useLayoutStore.getState().isWorkspaceDirty()).toBe(true);

      act(() => {
        expect(useLayoutStore.getState().resetCurrentWorkspace()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(getLayoutPresetFromLayout(state.layout)).toBe('simple');
      expect(state.isWorkspaceDirty()).toBe(false);
    });

    it('resetCurrentWorkspace restores user workspace snapshot', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('User workspace');
      });

      const savedSignature = getLayoutZoneSignature(useLayoutStore.getState().layout.rootZone);

      act(() => {
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
      });

      expect(useLayoutStore.getState().isWorkspaceDirty()).toBe(true);

      act(() => {
        expect(useLayoutStore.getState().resetCurrentWorkspace()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(getLayoutZoneSignature(state.layout.rootZone)).toBe(savedSignature);
      expect(state.isWorkspaceDirty()).toBe(false);
      expect(state.activeWorkspace.kind).toBe('user');
    });

    it('activateWorkspace switches built-in and user workspaces', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('My workspace');
      });

      const userId = useLayoutStore.getState().userWorkspaces[0]?.id;

      act(() => {
        expect(
          useLayoutStore.getState().activateWorkspace({ kind: 'builtin', preset: 'simple' }),
        ).toBe(true);
      });

      expect(getLayoutPresetFromLayout(useLayoutStore.getState().layout)).toBe('simple');
      expect(useLayoutStore.getState().activeWorkspace).toEqual({
        kind: 'builtin',
        preset: 'simple',
      });

      act(() => {
        expect(useLayoutStore.getState().activateWorkspace({ kind: 'user', id: userId! })).toBe(
          true,
        );
      });

      expect(useLayoutStore.getState().activeWorkspace).toEqual({ kind: 'user', id: userId });
    });

    it('deleteUserWorkspace switches active workspace to default built-in', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('To delete');
      });

      const userId = useLayoutStore.getState().userWorkspaces[0]?.id;

      act(() => {
        expect(useLayoutStore.getState().deleteUserWorkspace(userId!)).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.userWorkspaces).toHaveLength(0);
      expect(state.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(getLayoutPresetFromLayout(state.layout)).toBe(DEFAULT_BUILTIN_PRESET);
    });

    it('blocks activateWorkspace while layout edit mode is active', () => {
      act(() => {
        useLayoutStore.getState().setLayoutEditMode(true);
      });

      expect(
        useLayoutStore.getState().activateWorkspace({ kind: 'builtin', preset: 'simple' }),
      ).toBe(false);
      expect(useLayoutStore.getState().activeWorkspace.preset).toBe(DEFAULT_BUILTIN_PRESET);
    });

    it('blocks setLayoutPreset while layout edit mode is active', () => {
      act(() => {
        useLayoutStore.getState().setLayoutEditMode(true);
        useLayoutStore.getState().setLayoutPreset('simple');
      });

      expect(useLayoutStore.getState().activeWorkspace.preset).toBe(DEFAULT_BUILTIN_PRESET);
      expect(getLayoutPresetFromLayout(useLayoutStore.getState().layout)).toBe(
        DEFAULT_BUILTIN_PRESET,
      );
    });

    it('createScratchWorkspace activates scratch with empty layout', () => {
      act(() => {
        expect(useLayoutStore.getState().createScratchWorkspace()).toBe(true);
      });

      const state = useLayoutStore.getState();
      expect(state.activeWorkspace).toEqual({ kind: 'scratch' });
      expect(getLayoutPresetFromLayout(state.layout)).toBeNull();
      expect(state.isWorkspaceDirty()).toBe(false);
      expect(state.isLayoutEditMode).toBe(true);
    });

    it('resetCurrentWorkspace preserves collection instances when workspaceIds are shared', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('Collections snapshot');
      });

      const collectionIds = getCollectionWorkspaceIds(useLayoutStore.getState().layout);
      expect(collectionIds.length).toBeGreaterThan(0);

      act(() => {
        const rootId = useLayoutStore.getState().layout.rootZone.id;
        useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'player');
        expect(useLayoutStore.getState().resetCurrentWorkspace()).toBe(true);
      });

      const uiWorkspaces = useUIStore.getState().workspaces;
      for (const id of collectionIds) {
        expect(uiWorkspaces.some((workspace) => workspace.id === id)).toBe(true);
      }
    });

    it('activateWorkspace preserves collection instances when reactivating user workspace', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('My collections');
      });

      const userId = useLayoutStore.getState().userWorkspaces[0]?.id;
      const collectionIds = getCollectionWorkspaceIds(useLayoutStore.getState().layout);

      act(() => {
        expect(
          useLayoutStore.getState().activateWorkspace({ kind: 'builtin', preset: 'simple' }),
        ).toBe(true);
        expect(useLayoutStore.getState().activateWorkspace({ kind: 'user', id: userId! })).toBe(
          true,
        );
      });

      const uiWorkspaces = useUIStore.getState().workspaces;
      for (const id of collectionIds) {
        expect(uiWorkspaces.some((workspace) => workspace.id === id)).toBe(true);
      }
    });

    it('failed activateWorkspace does not teardown current layout instances', () => {
      act(() => {
        useLayoutStore.getState().saveCurrentWorkspaceAs('Saved');
      });

      const layoutSignatureBefore = getLayoutZoneSignature(
        useLayoutStore.getState().layout.rootZone,
      );
      const collectionIds = getCollectionWorkspaceIds(useLayoutStore.getState().layout);

      act(() => {
        expect(
          useLayoutStore.getState().activateWorkspace({ kind: 'user', id: 'missing-id' }),
        ).toBe(false);
      });

      expect(getLayoutZoneSignature(useLayoutStore.getState().layout.rootZone)).toBe(
        layoutSignatureBefore,
      );

      const uiWorkspaces = useUIStore.getState().workspaces;
      for (const id of collectionIds) {
        expect(uiWorkspaces.some((workspace) => workspace.id === id)).toBe(true);
      }
    });
  });

  describe('rehydration', () => {
    it('removes legacy key and defaults to collections when only legacy key exists', async () => {
      await electronStorage.removeItem(WORKSPACE_PERSIST_KEY);
      await electronStorage.setItem(LEGACY_LAYOUT_PERSIST_KEY, {
        state: { layout: { version: 1, rootZone: { id: 'legacy' } } },
        version: 3,
      });

      await useLayoutStore.persist.rehydrate();
      await Promise.resolve();

      const state = useLayoutStore.getState();
      expect(state.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(getLayoutPresetFromLayout(state.layout)).toBe(DEFAULT_BUILTIN_PRESET);

      const legacyValue = await electronStorage.getItem(LEGACY_LAYOUT_PERSIST_KEY);
      expect(legacyValue).toBeNull();
    });

    it('restores isLayoutEditMode false and baselineLayout after rehydrate', async () => {
      const persisted = createDefaultWorkspacePersistSlice();
      await electronStorage.setItem(WORKSPACE_PERSIST_KEY, {
        state: persisted,
        version: 1,
      });

      useLayoutStore.setState({
        isLayoutEditMode: true,
        baselineLayout: null,
        openLayoutEditPickerKey: 'picker-key',
      });

      await useLayoutStore.persist.rehydrate();
      await Promise.resolve();

      const state = useLayoutStore.getState();
      expect(state.isLayoutEditMode).toBe(false);
      expect(state.openLayoutEditPickerKey).toBeNull();
      expect(state.baselineLayout).not.toBeNull();
      expect(getLayoutZoneSignature(state.baselineLayout!.rootZone)).toBe(
        getLayoutZoneSignature(state.layout.rootZone),
      );
    });

    it('coerces persisted scratch to default built-in on rehydrate', async () => {
      await electronStorage.setItem(WORKSPACE_PERSIST_KEY, {
        state: {
          activeWorkspace: { kind: 'scratch' },
          userWorkspaces: [],
          layout: useLayoutStore.getState().layout,
        },
        version: 1,
      });

      await useLayoutStore.persist.rehydrate();
      await Promise.resolve();

      const state = useLayoutStore.getState();
      expect(state.activeWorkspace).toEqual({
        kind: 'builtin',
        preset: DEFAULT_BUILTIN_PRESET,
      });
      expect(getLayoutPresetFromLayout(state.layout)).toBe(DEFAULT_BUILTIN_PRESET);
    });
  });

  describe('computeIsWorkspaceDirty', () => {
    it('compares layout zone signatures', () => {
      const baseline = useLayoutStore.getState().layout;
      const modified = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
      const root = modified.rootZone as ContainerZone;
      const firstZone = root.zones[0];
      if (firstZone?.type === 'workspace') {
        firstZone.workspaceType = 'player';
      }

      expect(computeIsWorkspaceDirty(modified, baseline)).toBe(true);
      expect(computeIsWorkspaceDirty(baseline, baseline)).toBe(false);
    });
  });

  describe('persist key', () => {
    it('uses cherryplaylist-workspaces persist key', () => {
      expect(WORKSPACE_PERSIST_KEY).toBe('cherryplaylist-workspaces');
    });
  });
});
