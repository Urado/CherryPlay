import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { MAX_ZONES_PER_CONTAINER } from '@core/constants/layoutConstraints';
import { WorkspaceId } from '@core/types/workspace';
import type {
  ActiveWorkspace,
  LayoutPreset,
  UserWorkspace,
  WorkspacePersistSlice,
  WorkspaceRef,
} from '@core/types/workspacePreset';
import { allocateUnnamedWorkspaceName, DEFAULT_BUILTIN_PRESET } from '@core/types/workspacePreset';

import {
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
} from '../../core/constants/workspace';
import {
  Layout,
  Zone,
  ZoneId,
  ContainerZone,
  WorkspaceZone,
  SplitDirection,
} from '../../core/types/layout';
import { electronStorage } from '../storage/electronStorage';
import { registerActiveLayoutGetter } from '../utils/layoutFocusBridge';
import {
  createInitialLayout,
  createLayoutByPreset,
  createPartyLayout,
} from '../utils/layoutPresetFactories';
import { getLayoutStructureSignature, getLayoutZoneSignature } from '../utils/layoutSignature';
import {
  findZoneById,
  findParentZone,
  cleanupContainers,
  validateLayout,
  updateZoneInTree,
  syncContainerChildSizes,
} from '../utils/layoutUtils';
import { getCurrentLayoutViewport } from '../utils/layoutViewportBridge';
import type { LayoutEditAirSide } from '../utils/layoutWorkspaceOperations';
import {
  addAdjacentWorkspaceToLayout,
  addAdjacentWorkspaceToContainerLayout,
  addInitialWorkspaceToLayout,
  collectWorkspaceZones,
  createEmptyLayout,
  getAddWorkspaceErrorMessage,
  logAddAdjacentMinSizeViolation,
  getRemoveWorkspaceErrorMessage,
  migrateAimpZonesToPlayerInLayout,
  migrateDuplicateFileBrowserWorkspaceIds,
  isLayoutEmpty,
  removeWorkspaceFromLayout,
} from '../utils/layoutWorkspaceOperations';
import { cleanupWorkspaceInstance, prepareWorkspaceInstance } from '../utils/workspaceLifecycle';

import { useUIStore } from './uiStore';

export type { LayoutPreset } from '@core/types/workspacePreset';

export const WORKSPACE_PERSIST_KEY = 'cherryplaylist-workspaces';
export const LEGACY_LAYOUT_PERSIST_KEY = 'cherryplaylist-layout';

function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout;
}

function syncActiveUserWorkspaceLayoutInSlice(slice: WorkspacePersistSlice): WorkspacePersistSlice {
  if (slice.activeWorkspace.kind !== 'user') {
    return slice;
  }

  const activeId = slice.activeWorkspace.id;
  const syncedLayout = cloneLayout(slice.layout);

  return {
    ...slice,
    userWorkspaces: slice.userWorkspaces.map((workspace) =>
      workspace.id === activeId ? { ...workspace, layout: syncedLayout } : workspace,
    ),
  };
}

const LEGACY_PARTY_LAYOUT_SIGNATURE = 'horizontal(workspace:player,workspace:party)';
const LEGACY_AIMP_PARTY_LAYOUT_SIGNATURE = 'horizontal(workspace:aimp,workspace:party)';

function isLegacyPartyZone(zone: Zone): zone is WorkspaceZone {
  return (
    zone.type === 'workspace' &&
    (zone.workspaceType === 'party' || zone.workspaceId === 'party-workspace')
  );
}

function createPartyEditorZone(size: number): WorkspaceZone {
  return {
    id: uuidv4(),
    type: 'workspace',
    workspaceId: PARTY_EDITOR_WORKSPACE_ID,
    workspaceType: 'party-editor',
    size,
  };
}

function createPartyPreviewZone(size: number): WorkspaceZone {
  return {
    id: uuidv4(),
    type: 'workspace',
    workspaceId: PARTY_PREVIEW_WORKSPACE_ID,
    workspaceType: 'party-preview',
    size,
  };
}

function splitLegacyPartyZonesInContainer(container: ContainerZone): ContainerZone {
  const newZones: Zone[] = [];
  const newSizes: number[] = [];

  for (let i = 0; i < container.zones.length; i++) {
    const zone = container.zones[i];
    if (isLegacyPartyZone(zone)) {
      const halfSize = zone.size / 2;
      newZones.push(createPartyEditorZone(halfSize));
      newZones.push(createPartyPreviewZone(halfSize));
      newSizes.push(halfSize, halfSize);
    } else if (zone.type === 'container') {
      newZones.push(splitLegacyPartyZonesInTree(zone));
      newSizes.push(container.sizes[i]);
    } else {
      newZones.push(zone);
      newSizes.push(container.sizes[i]);
    }
  }

  return {
    ...container,
    zones: newZones,
    sizes: newSizes,
  };
}

function splitLegacyPartyZonesInTree(zone: Zone): Zone {
  if (zone.type === 'workspace') {
    return zone;
  }

  return splitLegacyPartyZonesInContainer(zone);
}

function layoutContainsLegacyParty(zone: Zone): boolean {
  if (zone.type === 'workspace') {
    return isLegacyPartyZone(zone);
  }

  return zone.zones.some(layoutContainsLegacyParty);
}

export function migrateLegacyPartyLayout(layout: Layout): Layout {
  const signature = getLayoutStructureSignature(layout.rootZone);

  if (signature === LEGACY_PARTY_LAYOUT_SIGNATURE) {
    return migrateAimpZonesToPlayerInLayout(createPartyLayout());
  }

  if (signature === LEGACY_AIMP_PARTY_LAYOUT_SIGNATURE) {
    return migrateAimpZonesToPlayerInLayout(createPartyLayout());
  }

  if (!layoutContainsLegacyParty(layout.rootZone)) {
    return migrateAimpZonesToPlayerInLayout(layout);
  }

  if (layout.rootZone.type === 'container') {
    return migrateAimpZonesToPlayerInLayout({
      ...layout,
      rootZone: splitLegacyPartyZonesInContainer(layout.rootZone),
    });
  }

  return migrateAimpZonesToPlayerInLayout(createPartyLayout());
}

export function migratePersistedLayoutState(
  persistedState: unknown,
  version: number,
): { layout: Layout } {
  if (version < 3) {
    const state = persistedState as { layout?: Layout } | undefined;
    const layout = state?.layout ?? createInitialLayout();
    return { layout: migrateLegacyPartyLayout(layout) };
  }
  return persistedState as { layout: Layout };
}

export function createDefaultWorkspacePersistSlice(): WorkspacePersistSlice {
  const layout = createInitialLayout();
  return {
    activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
    userWorkspaces: [],
    layout,
  };
}

export async function removeLegacyLayoutPersistKey(): Promise<void> {
  await electronStorage.removeItem(LEGACY_LAYOUT_PERSIST_KEY);
}

export function normalizeWorkspacePersistSlice(
  slice: WorkspacePersistSlice,
): WorkspacePersistSlice {
  if (slice.activeWorkspace.kind === 'scratch') {
    return {
      activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
      userWorkspaces: slice.userWorkspaces,
      layout: createLayoutByPreset(DEFAULT_BUILTIN_PRESET),
    };
  }

  if (slice.activeWorkspace.kind === 'user') {
    const userWorkspace = slice.userWorkspaces.find(
      (workspace) => workspace.id === slice.activeWorkspace.id,
    );
    if (!userWorkspace) {
      return {
        activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
        userWorkspaces: slice.userWorkspaces,
        layout: createLayoutByPreset(DEFAULT_BUILTIN_PRESET),
      };
    }
  }

  const activeWorkspace =
    slice.activeWorkspace.kind === 'builtin' && slice.activeWorkspace.preset === 'aimp-party'
      ? { kind: 'builtin' as const, preset: 'party' as const }
      : slice.activeWorkspace.kind === 'builtin' && slice.activeWorkspace.preset === 'collections'
        ? { kind: 'builtin' as const, preset: 'collections-vertical' as const }
        : slice.activeWorkspace;

  const layout = migrateDuplicateFileBrowserWorkspaceIds(
    migrateAimpZonesToPlayerInLayout(migrateLegacyPartyLayout(slice.layout)),
  );
  const userWorkspaces = slice.userWorkspaces.map((workspace) => ({
    ...workspace,
    layout: migrateDuplicateFileBrowserWorkspaceIds(
      migrateAimpZonesToPlayerInLayout(migrateLegacyPartyLayout(workspace.layout)),
    ),
  }));

  return {
    activeWorkspace,
    userWorkspaces,
    layout,
  };
}

export function migratePersistedWorkspaceState(
  persistedState: unknown,
  version: number,
): WorkspacePersistSlice {
  if (!persistedState || version === 0) {
    return createDefaultWorkspacePersistSlice();
  }

  const state = persistedState as Partial<WorkspacePersistSlice>;
  const layout = migrateLegacyPartyLayout(state.layout ?? createInitialLayout());
  const activeWorkspace = state.activeWorkspace ?? {
    kind: 'builtin' as const,
    preset: DEFAULT_BUILTIN_PRESET,
  };
  const userWorkspaces = Array.isArray(state.userWorkspaces) ? state.userWorkspaces : [];

  return normalizeWorkspacePersistSlice({ activeWorkspace, userWorkspaces, layout });
}

export function computeIsWorkspaceDirty(layout: Layout, baselineLayout: Layout | null): boolean {
  if (!baselineLayout) {
    return false;
  }

  return (
    getLayoutZoneSignature(layout.rootZone) !== getLayoutZoneSignature(baselineLayout.rootZone)
  );
}

function prepareLayoutWorkspaceInstances(layout: Layout): void {
  for (const zone of collectWorkspaceZones(layout.rootZone)) {
    prepareWorkspaceInstance(zone);
  }
}

function cleanupLayoutWorkspaceInstances(layout: Layout): void {
  for (const zone of collectWorkspaceZones(layout.rootZone)) {
    cleanupWorkspaceInstance(zone);
  }
}

export const LAYOUT_EMPTY_PICKER_KEY = 'empty';

export function getLayoutAirPickerKey(zoneId: ZoneId, side: LayoutEditAirSide): string {
  return `${zoneId}:${side}`;
}

export function getLayoutContainerAirPickerKey(
  containerId: ZoneId,
  side: LayoutEditAirSide,
): string {
  return `container:${containerId}:${side}`;
}

interface LayoutState {
  layout: Layout;
  activeWorkspace: ActiveWorkspace;
  userWorkspaces: UserWorkspace[];
  baselineLayout: Layout | null;
  isLayoutEditMode: boolean;
  openLayoutEditPickerKey: string | null;

  setLayoutEditMode: (enabled: boolean) => void;
  setOpenLayoutEditPickerKey: (key: string | null) => void;
  toggleLayoutEditMode: () => void;
  updateZoneSize: (zoneId: ZoneId, newSize: number) => void;
  updateContainerSizes: (containerId: ZoneId, sizes: number[]) => void;
  addZone: (
    parentId: ZoneId,
    workspaceId: WorkspaceId,
    workspaceType: string,
    direction?: SplitDirection,
  ) => void;
  removeZone: (zoneId: ZoneId) => void;
  setZoneDirection: (containerId: ZoneId, direction: SplitDirection) => void;
  replaceLayout: (newLayout: Layout) => void;
  setLayoutPreset: (preset: LayoutPreset) => void;
  activateWorkspace: (ref: WorkspaceRef) => boolean;
  saveCurrentWorkspace: () => boolean;
  saveCurrentWorkspaceAs: (name: string) => boolean;
  saveCurrentWorkspaceAsUnnamed: () => boolean;
  autoCommitWorkspaceChanges: () => boolean;
  resetCurrentWorkspace: () => boolean;
  createScratchWorkspace: () => boolean;
  renameUserWorkspace: (id: string, name: string) => boolean;
  deleteUserWorkspace: (id: string) => boolean;
  addAdjacentWorkspace: (
    targetZoneId: ZoneId,
    side: LayoutEditAirSide,
    workspaceType: string,
  ) => void;
  addAdjacentWorkspaceToContainer: (
    containerId: ZoneId,
    side: LayoutEditAirSide,
    workspaceType: string,
  ) => void;
  addInitialWorkspace: (workspaceType: string) => void;
  removeWorkspaceZone: (zoneId: ZoneId) => void;

  isWorkspaceDirty: () => boolean;
  findZone: (zoneId: ZoneId, root?: Zone) => Zone | null;
  findParent: (zoneId: ZoneId, root?: Zone, parent?: ContainerZone) => ContainerZone | null;
  cleanupEmptyContainers: () => void;
  validateLayout: () => boolean;
}

const initialLayout = createInitialLayout();

export const useLayoutStore = createWithEqualityFn<LayoutState>()(
  persist(
    (set, get) => ({
      layout: initialLayout,
      activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
      userWorkspaces: [],
      baselineLayout: cloneLayout(initialLayout),
      isLayoutEditMode: false,
      openLayoutEditPickerKey: null,

      setLayoutEditMode: (enabled) =>
        set({
          isLayoutEditMode: enabled,
          ...(enabled ? {} : { openLayoutEditPickerKey: null }),
        }),

      setOpenLayoutEditPickerKey: (key) => set({ openLayoutEditPickerKey: key }),

      toggleLayoutEditMode: () => {
        const next = !get().isLayoutEditMode;
        set({
          isLayoutEditMode: next,
          ...(next ? {} : { openLayoutEditPickerKey: null }),
        });
      },

      updateZoneSize: (zoneId, newSize) => {
        const state = get();
        const parent = state.findParent(zoneId);

        if (!parent) {
          return;
        }

        const zoneIndex = parent.zones.findIndex((z) => z.id === zoneId);
        if (zoneIndex === -1) {
          return;
        }

        const newSizes = [...parent.sizes];
        newSizes[zoneIndex] = newSize;

        const otherZonesTotal = newSizes.reduce((sum, size, idx) => {
          return idx === zoneIndex ? sum : sum + size;
        }, 0);

        const remainingSize = 100 - newSize;
        if (remainingSize > 0 && otherZonesTotal > 0) {
          const scale = remainingSize / otherZonesTotal;
          for (let i = 0; i < newSizes.length; i++) {
            if (i !== zoneIndex) {
              newSizes[i] = newSizes[i] * scale;
            }
          }
        }

        const updatedParent = syncContainerChildSizes({
          ...parent,
          sizes: newSizes,
        });

        const updatedLayout = { ...state.layout };
        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone, parent.id, updatedParent);

        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
      },

      updateContainerSizes: (containerId, sizes) => {
        const state = get();
        const container = state.findZone(containerId);

        if (!container || container.type !== 'container') {
          return;
        }

        if (sizes.length !== container.zones.length) {
          return;
        }

        const totalSize = sizes.reduce((sum, size) => sum + size, 0);
        if (Math.abs(totalSize - 100) > 0.01) {
          return;
        }

        const updatedContainer = syncContainerChildSizes({
          ...container,
          sizes,
        });

        const updatedLayout = { ...state.layout };
        updatedLayout.rootZone = updateZoneInTree(
          updatedLayout.rootZone,
          containerId,
          updatedContainer,
        );

        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
      },

      addZone: (parentId, workspaceId, workspaceType, _direction) => {
        const state = get();
        const parent = state.findZone(parentId);

        if (!parent || parent.type !== 'container') {
          return;
        }

        if (parent.zones.length >= MAX_ZONES_PER_CONTAINER) {
          return;
        }

        const newZone: WorkspaceZone = {
          id: uuidv4(),
          type: 'workspace',
          workspaceId,
          workspaceType,
          size: 0,
        };

        const updatedZones = [...parent.zones, newZone];

        const newSizes = updatedZones.map(() => 100 / updatedZones.length);

        const updatedZonesWithSizes = updatedZones.map((zone, index) => {
          if (zone.id === newZone.id) {
            return { ...zone, size: newSizes[index] };
          }
          if (zone.type === 'workspace') {
            return { ...zone, size: newSizes[index] };
          }
          return zone;
        });

        const updatedParent: ContainerZone = {
          ...parent,
          zones: updatedZonesWithSizes,
          sizes: newSizes,
        };

        const updatedLayout = { ...state.layout };
        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone, parentId, updatedParent);

        prepareWorkspaceInstance(newZone);
        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
      },

      removeZone: (zoneId) => {
        get().removeWorkspaceZone(zoneId);
      },

      setZoneDirection: (containerId, direction) => {
        const state = get();
        const container = state.findZone(containerId);

        if (!container || container.type !== 'container') {
          return;
        }

        const updatedContainer: ContainerZone = {
          ...container,
          direction,
        };

        const updatedLayout = { ...state.layout };
        updatedLayout.rootZone = updateZoneInTree(
          updatedLayout.rootZone,
          containerId,
          updatedContainer,
        );

        set({ layout: updatedLayout });
      },

      replaceLayout: (newLayout) => {
        set({ layout: newLayout });
      },

      setLayoutPreset: (preset) => {
        get().activateWorkspace({ kind: 'builtin', preset });
      },

      activateWorkspace: (ref) => {
        const state = get();
        if (state.isLayoutEditMode) {
          return false;
        }

        let newLayout: Layout;
        let activeWorkspace: ActiveWorkspace;

        if (ref.kind === 'builtin') {
          newLayout = createLayoutByPreset(ref.preset);
          activeWorkspace = { kind: 'builtin', preset: ref.preset };
        } else {
          const userWorkspace = state.userWorkspaces.find((workspace) => workspace.id === ref.id);
          if (!userWorkspace) {
            return false;
          }
          newLayout = cloneLayout(userWorkspace.layout);
          activeWorkspace = { kind: 'user', id: ref.id };
        }

        cleanupLayoutWorkspaceInstances(state.layout);

        if (ref.kind === 'user') {
          prepareLayoutWorkspaceInstances(newLayout);
        }

        set({
          layout: newLayout,
          activeWorkspace,
          baselineLayout: cloneLayout(newLayout),
          openLayoutEditPickerKey: null,
        });
        return true;
      },

      saveCurrentWorkspace: () => {
        const state = get();
        if (state.activeWorkspace.kind !== 'user') {
          return false;
        }

        const workspaceId = state.activeWorkspace.id;
        const now = new Date().toISOString();
        const savedLayout = cloneLayout(state.layout);

        set({
          userWorkspaces: state.userWorkspaces.map((workspace) =>
            workspace.id === workspaceId
              ? { ...workspace, layout: savedLayout, updatedAt: now }
              : workspace,
          ),
          baselineLayout: cloneLayout(state.layout),
        });

        return true;
      },

      saveCurrentWorkspaceAsUnnamed: () => {
        const state = get();
        const now = new Date().toISOString();
        const id = uuidv4();
        const savedLayout = cloneLayout(state.layout);
        const name = allocateUnnamedWorkspaceName(state.userWorkspaces.map((w) => w.name));
        const newWorkspace: UserWorkspace = {
          id,
          name,
          layout: savedLayout,
          createdAt: now,
          updatedAt: now,
        };

        set({
          userWorkspaces: [...state.userWorkspaces, newWorkspace],
          activeWorkspace: { kind: 'user', id },
          baselineLayout: cloneLayout(state.layout),
        });
        return true;
      },

      autoCommitWorkspaceChanges: () => {
        const state = get();
        if (!state.isWorkspaceDirty()) {
          return true;
        }

        if (state.activeWorkspace.kind === 'user') {
          return get().saveCurrentWorkspace();
        }

        if (state.activeWorkspace.kind === 'builtin' || state.activeWorkspace.kind === 'scratch') {
          return get().saveCurrentWorkspaceAsUnnamed();
        }

        return true;
      },

      saveCurrentWorkspaceAs: (name) => {
        const state = get();
        const trimmedName = name.trim();
        if (!trimmedName) {
          return false;
        }

        if (state.userWorkspaces.some((workspace) => workspace.name === trimmedName)) {
          useUIStore.getState().addNotification({
            type: 'error',
            message: 'Рабочее пространство с таким именем уже существует',
          });
          return false;
        }

        const now = new Date().toISOString();
        const id = uuidv4();
        const savedLayout = cloneLayout(state.layout);
        const newWorkspace: UserWorkspace = {
          id,
          name: trimmedName,
          layout: savedLayout,
          createdAt: now,
          updatedAt: now,
        };

        set({
          userWorkspaces: [...state.userWorkspaces, newWorkspace],
          activeWorkspace: { kind: 'user', id },
          baselineLayout: cloneLayout(state.layout),
        });
        return true;
      },

      resetCurrentWorkspace: () => {
        const state = get();
        let newLayout: Layout;
        let isUserWorkspace = false;

        switch (state.activeWorkspace.kind) {
          case 'builtin':
            newLayout = createLayoutByPreset(state.activeWorkspace.preset);
            break;
          case 'user': {
            const userWorkspace = state.userWorkspaces.find(
              (workspace) => workspace.id === state.activeWorkspace.id,
            );
            if (!userWorkspace) {
              return false;
            }
            newLayout = cloneLayout(userWorkspace.layout);
            isUserWorkspace = true;
            break;
          }
          case 'scratch':
            newLayout = createEmptyLayout();
            break;
          default:
            return false;
        }

        cleanupLayoutWorkspaceInstances(state.layout);

        if (isUserWorkspace) {
          prepareLayoutWorkspaceInstances(newLayout);
        }

        set({
          layout: newLayout,
          baselineLayout: cloneLayout(newLayout),
          openLayoutEditPickerKey: null,
        });
        return true;
      },

      createScratchWorkspace: () => {
        const state = get();
        if (state.isLayoutEditMode) {
          return false;
        }

        cleanupLayoutWorkspaceInstances(state.layout);
        const newLayout = createEmptyLayout();

        set({
          layout: newLayout,
          activeWorkspace: { kind: 'scratch' },
          baselineLayout: cloneLayout(newLayout),
          openLayoutEditPickerKey: null,
          isLayoutEditMode: true,
        });
        return true;
      },

      renameUserWorkspace: (id, name) => {
        const state = get();
        const trimmedName = name.trim();
        if (!trimmedName) {
          return false;
        }

        if (
          state.userWorkspaces.some(
            (workspace) => workspace.name === trimmedName && workspace.id !== id,
          )
        ) {
          useUIStore.getState().addNotification({
            type: 'error',
            message: 'Рабочее пространство с таким именем уже существует',
          });
          return false;
        }

        const workspaceExists = state.userWorkspaces.some((workspace) => workspace.id === id);
        if (!workspaceExists) {
          return false;
        }

        set({
          userWorkspaces: state.userWorkspaces.map((workspace) =>
            workspace.id === id ? { ...workspace, name: trimmedName } : workspace,
          ),
        });
        return true;
      },

      deleteUserWorkspace: (id) => {
        const state = get();
        const workspaceExists = state.userWorkspaces.some((workspace) => workspace.id === id);
        if (!workspaceExists) {
          return false;
        }

        const isActive = state.activeWorkspace.kind === 'user' && state.activeWorkspace.id === id;
        const nextUserWorkspaces = state.userWorkspaces.filter((workspace) => workspace.id !== id);

        if (isActive) {
          cleanupLayoutWorkspaceInstances(state.layout);
          const newLayout = createLayoutByPreset(DEFAULT_BUILTIN_PRESET);
          set({
            userWorkspaces: nextUserWorkspaces,
            layout: newLayout,
            activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
            baselineLayout: cloneLayout(newLayout),
            openLayoutEditPickerKey: null,
          });
        } else {
          set({ userWorkspaces: nextUserWorkspaces });
        }

        return true;
      },

      isWorkspaceDirty: () => {
        const state = get();
        return computeIsWorkspaceDirty(state.layout, state.baselineLayout);
      },

      addAdjacentWorkspace: (targetZoneId, side, workspaceType) => {
        const state = get();
        const result = addAdjacentWorkspaceToLayout(
          state.layout,
          targetZoneId,
          side,
          workspaceType,
          getCurrentLayoutViewport(),
        );

        if (!result.ok) {
          logAddAdjacentMinSizeViolation(result);
          useUIStore.getState().addNotification({
            type: 'warning',
            message: getAddWorkspaceErrorMessage(result.reason),
          });
          return;
        }

        prepareWorkspaceInstance(result.preparedZone);
        set({ layout: result.layout, openLayoutEditPickerKey: null });
      },

      addAdjacentWorkspaceToContainer: (containerId, side, workspaceType) => {
        const state = get();
        const result = addAdjacentWorkspaceToContainerLayout(
          state.layout,
          containerId,
          side,
          workspaceType,
          getCurrentLayoutViewport(),
        );

        if (!result.ok) {
          logAddAdjacentMinSizeViolation(result);
          useUIStore.getState().addNotification({
            type: 'warning',
            message: getAddWorkspaceErrorMessage(result.reason),
          });
          return;
        }

        prepareWorkspaceInstance(result.preparedZone);
        set({ layout: result.layout, openLayoutEditPickerKey: null });
      },

      addInitialWorkspace: (workspaceType) => {
        const state = get();
        if (!isLayoutEmpty(state.layout)) {
          return;
        }

        const result = addInitialWorkspaceToLayout(workspaceType, getCurrentLayoutViewport());

        if (!result.ok) {
          logAddAdjacentMinSizeViolation(result);
          useUIStore.getState().addNotification({
            type: 'warning',
            message: getAddWorkspaceErrorMessage(result.reason),
          });
          return;
        }

        prepareWorkspaceInstance(result.preparedZone);
        set({ layout: result.layout });
      },

      removeWorkspaceZone: (zoneId) => {
        const state = get();
        const result = removeWorkspaceFromLayout(state.layout, zoneId);

        if (!result.ok) {
          useUIStore.getState().addNotification({
            type: 'warning',
            message: getRemoveWorkspaceErrorMessage(result.reason),
          });
          return;
        }

        set({
          layout: result.layout,
          openLayoutEditPickerKey: null,
        });
        cleanupWorkspaceInstance(result.removedZone);
      },

      findZone: (zoneId, root) => {
        const state = get();
        const searchRoot = root || state.layout.rootZone;
        return findZoneById(searchRoot, zoneId);
      },

      findParent: (zoneId, root, parent) => {
        const state = get();
        const searchRoot = root || state.layout.rootZone;
        return findParentZone(searchRoot, zoneId, parent || null);
      },

      cleanupEmptyContainers: () => {
        const state = get();
        const cleaned = cleanupContainers(state.layout.rootZone);

        if (cleaned.id !== state.layout.rootZone.id) {
          set({
            layout: {
              ...state.layout,
              rootZone: cleaned,
            },
          });
        }
      },

      validateLayout: () => {
        const state = get();
        const containerWidth = 1200;
        const containerHeight = 800;
        return validateLayout(state.layout.rootZone, containerWidth, containerHeight);
      },
    }),
    {
      name: WORKSPACE_PERSIST_KEY,
      version: 1,
      storage: electronStorage,
      partialize: (state) => {
        const persistSlice = normalizeWorkspacePersistSlice({
          activeWorkspace: state.activeWorkspace,
          userWorkspaces: state.userWorkspaces,
          layout: state.layout,
        });
        return syncActiveUserWorkspaceLayoutInSlice(persistSlice);
      },
      migrate: (persistedState: unknown, version: number) =>
        migratePersistedWorkspaceState(persistedState, version),
      onRehydrateStorage: () => async (state) => {
        await removeLegacyLayoutPersistKey();

        if (!state) {
          return;
        }

        const normalized = syncActiveUserWorkspaceLayoutInSlice(
          normalizeWorkspacePersistSlice({
            activeWorkspace: state.activeWorkspace,
            userWorkspaces: state.userWorkspaces,
            layout: state.layout,
          }),
        );

        useLayoutStore.setState({
          activeWorkspace: normalized.activeWorkspace,
          userWorkspaces: normalized.userWorkspaces,
          layout: normalized.layout,
          baselineLayout: cloneLayout(normalized.layout),
          isLayoutEditMode: false,
          openLayoutEditPickerKey: null,
        });
      },
    },
  ),
);

registerActiveLayoutGetter(() => useLayoutStore.getState().layout);
