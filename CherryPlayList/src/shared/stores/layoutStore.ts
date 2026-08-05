import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { MAX_ZONES_PER_CONTAINER } from '@core/constants/layoutConstraints';
import { WorkspaceId } from '@core/types/workspace';
import type {
  ActiveWorkspace,
  BuiltinLayoutOverrides,
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
import {
  getLayoutStructureDirtySignature,
  getLayoutStructureSignature,
  getLayoutZoneSignature,
} from '../utils/layoutSignature';
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

const KNOWN_LAYOUT_PRESET_KEYS: readonly LayoutPreset[] = [
  'simple',
  'complex',
  'collections',
  'collections-vertical',
  'player',
  'party',
  'aimp-party',
];

function isKnownLayoutPresetKey(key: string): key is LayoutPreset {
  return (KNOWN_LAYOUT_PRESET_KEYS as readonly string[]).includes(key);
}

function migrateBuiltinPresetKey(preset: LayoutPreset): LayoutPreset {
  if (preset === 'aimp-party') {
    return 'party';
  }
  if (preset === 'collections') {
    return 'collections-vertical';
  }
  return preset;
}

function migrateLayoutTree(layout: Layout): Layout {
  return migrateDuplicateFileBrowserWorkspaceIds(
    migrateAimpZonesToPlayerInLayout(migrateLegacyPartyLayout(layout)),
  );
}

export function normalizeBuiltinLayoutOverrides(
  overrides: BuiltinLayoutOverrides | undefined | null,
): BuiltinLayoutOverrides {
  if (!overrides || typeof overrides !== 'object') {
    return {};
  }

  const legacyEntries: Array<{ target: LayoutPreset; layout: Layout }> = [];
  const canonicalEntries: Array<{ target: LayoutPreset; layout: Layout }> = [];

  for (const [key, layout] of Object.entries(overrides)) {
    if (!isKnownLayoutPresetKey(key) || !layout || typeof layout !== 'object') {
      continue;
    }

    const target = migrateBuiltinPresetKey(key);
    const migratedLayout = migrateLayoutTree(layout);
    const entry = { target, layout: migratedLayout };

    if (key === target) {
      canonicalEntries.push(entry);
    } else {
      legacyEntries.push(entry);
    }
  }

  const result: BuiltinLayoutOverrides = {};
  for (const entry of legacyEntries) {
    result[entry.target] = entry.layout;
  }
  for (const entry of canonicalEntries) {
    result[entry.target] = entry.layout;
  }
  return result;
}

export function resolveBuiltinLayout(
  preset: LayoutPreset,
  overrides: BuiltinLayoutOverrides,
): Layout {
  const normalizedPreset = migrateBuiltinPresetKey(preset);
  const override = overrides[normalizedPreset];
  if (override) {
    return cloneLayout(override);
  }
  return createLayoutByPreset(normalizedPreset);
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
    builtinLayoutOverrides: {},
  };
}

export async function removeLegacyLayoutPersistKey(): Promise<void> {
  await electronStorage.removeItem(LEGACY_LAYOUT_PERSIST_KEY);
}

export function normalizeWorkspacePersistSlice(
  slice: WorkspacePersistSlice,
): WorkspacePersistSlice {
  const builtinLayoutOverrides = normalizeBuiltinLayoutOverrides(slice.builtinLayoutOverrides);
  const userWorkspaces = slice.userWorkspaces.map((workspace) => ({
    ...workspace,
    layout: migrateLayoutTree(workspace.layout),
  }));

  if (slice.activeWorkspace.kind === 'scratch') {
    return {
      activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
      userWorkspaces,
      layout: resolveBuiltinLayout(DEFAULT_BUILTIN_PRESET, builtinLayoutOverrides),
      builtinLayoutOverrides,
    };
  }

  if (slice.activeWorkspace.kind === 'user') {
    const userWorkspace = userWorkspaces.find(
      (workspace) => workspace.id === slice.activeWorkspace.id,
    );
    if (!userWorkspace) {
      return {
        activeWorkspace: { kind: 'builtin', preset: DEFAULT_BUILTIN_PRESET },
        userWorkspaces,
        layout: resolveBuiltinLayout(DEFAULT_BUILTIN_PRESET, builtinLayoutOverrides),
        builtinLayoutOverrides,
      };
    }

    return {
      activeWorkspace: slice.activeWorkspace,
      userWorkspaces,
      layout: migrateLayoutTree(slice.layout),
      builtinLayoutOverrides,
    };
  }

  const activeWorkspace: ActiveWorkspace = {
    kind: 'builtin',
    preset: migrateBuiltinPresetKey(slice.activeWorkspace.preset),
  };

  return {
    activeWorkspace,
    userWorkspaces,
    layout: resolveBuiltinLayout(activeWorkspace.preset, builtinLayoutOverrides),
    builtinLayoutOverrides,
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
  const builtinLayoutOverrides = normalizeBuiltinLayoutOverrides(state.builtinLayoutOverrides);

  return normalizeWorkspacePersistSlice({
    activeWorkspace,
    userWorkspaces,
    layout,
    builtinLayoutOverrides,
  });
}

export function computeIsWorkspaceDirty(
  layout: Layout,
  baselineLayout: Layout | null,
  options?: { structureOnly?: boolean },
): boolean {
  if (!baselineLayout) {
    return false;
  }

  if (options?.structureOnly) {
    return (
      getLayoutStructureDirtySignature(layout.rootZone) !==
      getLayoutStructureDirtySignature(baselineLayout.rootZone)
    );
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
  builtinLayoutOverrides: BuiltinLayoutOverrides;
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
  clearBuiltinOverride: (preset: LayoutPreset) => boolean;
  hasBuiltinOverride: (preset: LayoutPreset) => boolean;
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
      builtinLayoutOverrides: {},
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
          const preset = migrateBuiltinPresetKey(ref.preset);
          newLayout = resolveBuiltinLayout(preset, state.builtinLayoutOverrides);
          activeWorkspace = { kind: 'builtin', preset };
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

        if (state.activeWorkspace.kind === 'builtin') {
          const baseline = state.baselineLayout;
          if (!baseline) {
            return true;
          }

          const structureDirty = computeIsWorkspaceDirty(state.layout, baseline, {
            structureOnly: true,
          });

          if (structureDirty) {
            const preset = state.activeWorkspace.preset;
            const savedLayout = cloneLayout(state.layout);
            set({
              builtinLayoutOverrides: {
                ...state.builtinLayoutOverrides,
                [preset]: savedLayout,
              },
              baselineLayout: cloneLayout(state.layout),
              activeWorkspace: { kind: 'builtin', preset },
            });
            return true;
          }

          if (computeIsWorkspaceDirty(state.layout, baseline)) {
            set({ layout: cloneLayout(baseline) });
          }
          return true;
        }

        if (!state.isWorkspaceDirty()) {
          return true;
        }

        if (state.activeWorkspace.kind === 'user') {
          return get().saveCurrentWorkspace();
        }

        if (state.activeWorkspace.kind === 'scratch') {
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

        if (state.activeWorkspace.kind === 'builtin') {
          return get().clearBuiltinOverride(state.activeWorkspace.preset);
        }

        let newLayout: Layout;
        let isUserWorkspace = false;

        switch (state.activeWorkspace.kind) {
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

      clearBuiltinOverride: (preset) => {
        const state = get();
        const normalizedPreset = migrateBuiltinPresetKey(preset);
        const nextOverrides: BuiltinLayoutOverrides = { ...state.builtinLayoutOverrides };
        delete nextOverrides[normalizedPreset];
        const newLayout = createLayoutByPreset(normalizedPreset);
        const isActiveBuiltin =
          state.activeWorkspace.kind === 'builtin' &&
          state.activeWorkspace.preset === normalizedPreset;

        if (isActiveBuiltin) {
          cleanupLayoutWorkspaceInstances(state.layout);
          set({
            builtinLayoutOverrides: nextOverrides,
            layout: newLayout,
            baselineLayout: cloneLayout(newLayout),
            openLayoutEditPickerKey: null,
          });
        } else {
          set({ builtinLayoutOverrides: nextOverrides });
        }

        return true;
      },

      hasBuiltinOverride: (preset) => {
        const normalizedPreset = migrateBuiltinPresetKey(preset);
        return Boolean(get().builtinLayoutOverrides[normalizedPreset]);
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
          const newLayout = resolveBuiltinLayout(
            DEFAULT_BUILTIN_PRESET,
            state.builtinLayoutOverrides,
          );
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
        if (state.activeWorkspace.kind === 'builtin') {
          return computeIsWorkspaceDirty(state.layout, state.baselineLayout, {
            structureOnly: true,
          });
        }
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
          builtinLayoutOverrides: state.builtinLayoutOverrides,
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
            builtinLayoutOverrides: state.builtinLayoutOverrides ?? {},
          }),
        );

        useLayoutStore.setState({
          activeWorkspace: normalized.activeWorkspace,
          userWorkspaces: normalized.userWorkspaces,
          layout: normalized.layout,
          builtinLayoutOverrides: normalized.builtinLayoutOverrides,
          baselineLayout: cloneLayout(normalized.layout),
          isLayoutEditMode: false,
          openLayoutEditPickerKey: null,
        });
      },
    },
  ),
);

registerActiveLayoutGetter(() => useLayoutStore.getState().layout);
