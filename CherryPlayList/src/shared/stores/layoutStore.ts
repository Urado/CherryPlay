import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { MAX_ZONES_PER_CONTAINER } from '@core/constants/layoutConstraints';
import { WorkspaceId } from '@core/types/workspace';

import {
  AIMP_WORKSPACE_ID,
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  DEFAULT_PLAYLIST_WORKSPACE_ID,
  DEFAULT_PLAYER_WORKSPACE_ID,
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  generateWorkspaceId,
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
import { getLayoutZoneSignature } from '../utils/layoutSignature';
import {
  findZoneById,
  findParentZone,
  cleanupContainers,
  validateLayout,
  updateZoneInTree,
} from '../utils/layoutUtils';
import type { LayoutEditAirSide } from '../utils/layoutWorkspaceOperations';
import {
  addAdjacentWorkspaceToLayout,
  addInitialWorkspaceToLayout,
  collectWorkspaceZones,
  getAddWorkspaceErrorMessage,
  getRemoveWorkspaceErrorMessage,
  getWorkspaceAddedMessage,
  isLayoutEmpty,
  removeWorkspaceFromLayout,
} from '../utils/layoutWorkspaceOperations';
import {
  cleanupWorkspaceInstance,
  prepareWorkspaceInstance,
  setupCollectionZoneForPreset,
} from '../utils/workspaceLifecycle';

import { useUIStore } from './uiStore';

/**
 * Создает простой layout с двумя зонами (плейлист и браузер)
 */
function createSimpleLayout(): Layout {
  const playlistZoneId = uuidv4();
  const fileBrowserZoneId = uuidv4();
  const rootContainerId = uuidv4();

  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: playlistZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 50,
        },
        {
          id: fileBrowserZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
          workspaceType: 'fileBrowser',
          size: 50,
        },
      ],
      sizes: [50, 50],
    },
    version: 1,
  };
}

/**
 * Создает layout с коллекциями вертикально
 * Структура:
 * - Root (horizontal)
 *   - Playlist (33%)
 *   - Vertical Container (33%)
 *     - Collection 1
 *     - Collection 2
 *   - File Browser (34%)
 */
function createCollectionsVerticalLayout(): Layout {
  const playlistZoneId = uuidv4();
  const fileBrowserZoneId = uuidv4();
  const collection1ZoneId = uuidv4();
  const collection2ZoneId = uuidv4();
  const verticalContainerId = uuidv4();
  const rootContainerId = uuidv4();

  // Генерируем уникальные workspaceId для коллекций
  const collection1WorkspaceId = generateWorkspaceId();
  const collection2WorkspaceId = generateWorkspaceId();

  const collection1Zone: WorkspaceZone = {
    id: collection1ZoneId,
    type: 'workspace',
    workspaceId: collection1WorkspaceId,
    workspaceType: 'collection',
    size: 50,
  };

  const collection2Zone: WorkspaceZone = {
    id: collection2ZoneId,
    type: 'workspace',
    workspaceId: collection2WorkspaceId,
    workspaceType: 'collection',
    size: 50,
  };

  setupCollectionZoneForPreset(collection1Zone, 'Collection 1');
  setupCollectionZoneForPreset(collection2Zone, 'Collection 2');

  // Вертикальный контейнер с двумя коллекциями
  const verticalContainer: ContainerZone = {
    id: verticalContainerId,
    type: 'container',
    direction: 'vertical',
    zones: [collection1Zone, collection2Zone],
    sizes: [50, 50],
  };

  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: playlistZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 33,
        },
        verticalContainer,
        {
          id: fileBrowserZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
          workspaceType: 'fileBrowser',
          size: 34,
        },
      ],
      sizes: [33, 33, 34],
    },
    version: 1,
  };
}

/**
 * Создает layout с коллекциями
 * Структура:
 * - Root (horizontal)
 *   - Playlist
 *   - Vertical Container
 *     - Horizontal Container (Collection 1, Collection 2)
 *     - File Browser
 */
function createCollectionsLayout(): Layout {
  const playlistZoneId = uuidv4();
  const fileBrowserZoneId = uuidv4();
  const collection1ZoneId = uuidv4();
  const collection2ZoneId = uuidv4();
  const horizontalContainerId = uuidv4();
  const verticalContainerId = uuidv4();
  const rootContainerId = uuidv4();

  // Генерируем уникальные workspaceId для коллекций
  const collection1WorkspaceId = generateWorkspaceId();
  const collection2WorkspaceId = generateWorkspaceId();

  const collection1Zone: WorkspaceZone = {
    id: collection1ZoneId,
    type: 'workspace',
    workspaceId: collection1WorkspaceId,
    workspaceType: 'collection',
    size: 50,
  };

  const collection2Zone: WorkspaceZone = {
    id: collection2ZoneId,
    type: 'workspace',
    workspaceId: collection2WorkspaceId,
    workspaceType: 'collection',
    size: 50,
  };

  setupCollectionZoneForPreset(collection1Zone, 'Collection 1');
  setupCollectionZoneForPreset(collection2Zone, 'Collection 2');

  // Горизонтальный контейнер с двумя коллекциями
  const horizontalContainer: ContainerZone = {
    id: horizontalContainerId,
    type: 'container',
    direction: 'horizontal',
    zones: [collection1Zone, collection2Zone],
    sizes: [50, 50],
  };

  // Вертикальный контейнер с горизонтальным контейнером и браузером
  const verticalContainer: ContainerZone = {
    id: verticalContainerId,
    type: 'container',
    direction: 'vertical',
    zones: [
      horizontalContainer,
      {
        id: fileBrowserZoneId,
        type: 'workspace',
        workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
        workspaceType: 'fileBrowser',
        size: 50,
      },
    ],
    sizes: [50, 50],
  };

  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: playlistZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 50,
        },
        verticalContainer,
      ],
      sizes: [50, 50],
    },
    version: 1,
  };
}

/**
 * Создает layout с рекурсивной структурой для тестирования
 * Структура:
 * - Root (horizontal)
 *   - Playlist (33%)
 *   - Test Zone 7 (33%)
 *   - Vertical Container (34%)
 *     - Horizontal Container 1 (33%)
 *       - Test Zone 1 (33%)
 *       - Test Zone 2 (33%)
 *       - Test Zone 5 (34%)
 *     - Horizontal Container 2 (33%)
 *       - Test Zone 3 (33%)
 *       - Test Zone 4 (33%)
 *       - Test Zone 6 (34%)
 *     - Horizontal Container 3 (34%)
 *       - Test Zone 8 (100%)
 */
function createComplexLayout(): Layout {
  const playlistZoneId = uuidv4();
  const rootContainerId = uuidv4();

  // Тестовые зоны
  const testZone1Id = uuidv4();
  const testZone2Id = uuidv4();
  const testZone3Id = uuidv4();
  const testZone4Id = uuidv4();
  const testZone5Id = uuidv4();
  const testZone6Id = uuidv4();
  const testZone7Id = uuidv4();
  const testZone8Id = uuidv4();

  // Горизонтальные контейнеры для тестовых зон
  const horizontalContainer1Id = uuidv4();
  const horizontalContainer2Id = uuidv4();
  const horizontalContainer3Id = uuidv4();

  // Вертикальный контейнер
  const verticalContainerId = uuidv4();

  // Первый горизонтальный контейнер с тремя тестовыми зонами
  const horizontalContainer1: ContainerZone = {
    id: horizontalContainer1Id,
    type: 'container',
    direction: 'horizontal',
    zones: [
      {
        id: testZone1Id,
        type: 'workspace',
        workspaceId: 'test-workspace-1',
        workspaceType: 'test1',
        size: 33.33,
      },
      {
        id: testZone2Id,
        type: 'workspace',
        workspaceId: 'test-workspace-2',
        workspaceType: 'test2',
        size: 33.33,
      },
      {
        id: testZone5Id,
        type: 'workspace',
        workspaceId: 'test-workspace-5',
        workspaceType: 'test5',
        size: 33.34,
      },
    ],
    sizes: [33.33, 33.33, 33.34],
  };

  // Второй горизонтальный контейнер с тремя тестовыми зонами
  const horizontalContainer2: ContainerZone = {
    id: horizontalContainer2Id,
    type: 'container',
    direction: 'horizontal',
    zones: [
      {
        id: testZone3Id,
        type: 'workspace',
        workspaceId: 'test-workspace-3',
        workspaceType: 'test3',
        size: 33.33,
      },
      {
        id: testZone4Id,
        type: 'workspace',
        workspaceId: 'test-workspace-4',
        workspaceType: 'test4',
        size: 33.33,
      },
      {
        id: testZone6Id,
        type: 'workspace',
        workspaceId: 'test-workspace-6',
        workspaceType: 'test6',
        size: 33.34,
      },
    ],
    sizes: [33.33, 33.33, 33.34],
  };

  // Третий горизонтальный контейнер с одной тестовой зоной
  const horizontalContainer3: ContainerZone = {
    id: horizontalContainer3Id,
    type: 'container',
    direction: 'horizontal',
    zones: [
      {
        id: testZone8Id,
        type: 'workspace',
        workspaceId: 'test-workspace-8',
        workspaceType: 'test8',
        size: 100,
      },
    ],
    sizes: [100],
  };

  // Вертикальный контейнер с тремя горизонтальными контейнерами
  const verticalContainer: ContainerZone = {
    id: verticalContainerId,
    type: 'container',
    direction: 'vertical',
    zones: [horizontalContainer1, horizontalContainer2, horizontalContainer3],
    sizes: [33.33, 33.33, 33.34],
  };

  // Root контейнер с плейлистом, тестовой зоной 7 и вертикальным контейнером
  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: playlistZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 33.33,
        },
        {
          id: testZone7Id,
          type: 'workspace',
          workspaceId: 'test-workspace-7',
          workspaceType: 'test7',
          size: 33.33,
        },
        verticalContainer,
      ],
      sizes: [33.33, 33.33, 33.34],
    },
    version: 1,
  };
}

/**
 * Типы предустановленных layout
 */
export type LayoutPreset =
  | 'simple'
  | 'complex'
  | 'collections'
  | 'collections-vertical'
  | 'player'
  | 'party'
  | 'aimp-party';

/**
 * Создает layout для player workspace
 * Структура:
 * - Root (horizontal)
 *   - Player workspace (50%)
 *   - File Browser workspace (50%)
 */
function createPlayerLayout(): Layout {
  const playerZoneId = uuidv4();
  const fileBrowserZoneId = uuidv4();
  const rootContainerId = uuidv4();

  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: playerZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
          workspaceType: 'player',
          size: 50,
        },
        {
          id: fileBrowserZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
          workspaceType: 'fileBrowser',
          size: 50,
        },
      ],
      sizes: [50, 50],
    },
    version: 1,
  };
}

/**
 * Создает layout для party workspace
 * Структура:
 * - Root (horizontal)
 *   - Player workspace (50%)
 *   - Party Editor workspace (25%)
 *   - Party Preview workspace (25%)
 */
function createPartyLayout(): Layout {
  const playerZoneId = uuidv4();
  const partyEditorZoneId = uuidv4();
  const partyPreviewZoneId = uuidv4();
  const rootContainerId = uuidv4();

  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: playerZoneId,
          type: 'workspace',
          workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
          workspaceType: 'player',
          size: 50,
        },
        {
          id: partyEditorZoneId,
          type: 'workspace',
          workspaceId: PARTY_EDITOR_WORKSPACE_ID,
          workspaceType: 'party-editor',
          size: 25,
        },
        {
          id: partyPreviewZoneId,
          type: 'workspace',
          workspaceId: PARTY_PREVIEW_WORKSPACE_ID,
          workspaceType: 'party-preview',
          size: 25,
        },
      ],
      sizes: [50, 25, 25],
    },
    version: 1,
  };
}

function createAimpPartyLayout(): Layout {
  const aimpZoneId = uuidv4();
  const partyEditorZoneId = uuidv4();
  const partyPreviewZoneId = uuidv4();
  const rootContainerId = uuidv4();

  return {
    rootZone: {
      id: rootContainerId,
      type: 'container',
      direction: 'horizontal',
      zones: [
        {
          id: aimpZoneId,
          type: 'workspace',
          workspaceId: AIMP_WORKSPACE_ID,
          workspaceType: 'aimp',
          size: 50,
        },
        {
          id: partyEditorZoneId,
          type: 'workspace',
          workspaceId: PARTY_EDITOR_WORKSPACE_ID,
          workspaceType: 'party-editor',
          size: 25,
        },
        {
          id: partyPreviewZoneId,
          type: 'workspace',
          workspaceId: PARTY_PREVIEW_WORKSPACE_ID,
          workspaceType: 'party-preview',
          size: 25,
        },
      ],
      sizes: [50, 25, 25],
    },
    version: 1,
  };
}

/**
 * Создает layout по имени предустановки
 */
function createLayoutByPreset(preset: LayoutPreset): Layout {
  switch (preset) {
    case 'simple':
      return createSimpleLayout();
    case 'complex':
      return createComplexLayout();
    case 'collections':
      return createCollectionsLayout();
    case 'collections-vertical':
      return createCollectionsVerticalLayout();
    case 'player':
      return createPlayerLayout();
    case 'party':
      return createPartyLayout();
    case 'aimp-party':
      return createAimpPartyLayout();
    default:
      return createSimpleLayout();
  }
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
  const signature = getLayoutZoneSignature(layout.rootZone);

  if (signature === LEGACY_PARTY_LAYOUT_SIGNATURE) {
    return createPartyLayout();
  }

  if (signature === LEGACY_AIMP_PARTY_LAYOUT_SIGNATURE) {
    return createAimpPartyLayout();
  }

  if (!layoutContainsLegacyParty(layout.rootZone)) {
    return layout;
  }

  if (layout.rootZone.type === 'container') {
    return {
      ...layout,
      rootZone: splitLegacyPartyZonesInContainer(layout.rootZone),
    };
  }

  return createPartyLayout();
}

/**
 * Создает начальный layout (по умолчанию с коллекциями)
 */
function createInitialLayout(): Layout {
  return createCollectionsLayout();
}

/** Persist migration entry point (v3 splits legacy party workspace into editor + preview). */
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

export const LAYOUT_EMPTY_PICKER_KEY = 'empty';

export function getLayoutAirPickerKey(zoneId: ZoneId, side: LayoutEditAirSide): string {
  return `${zoneId}:${side}`;
}

interface LayoutState {
  layout: Layout;
  isLayoutEditMode: boolean;
  openLayoutEditPickerKey: string | null;

  // Actions
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
  addAdjacentWorkspace: (
    targetZoneId: ZoneId,
    side: LayoutEditAirSide,
    workspaceType: string,
  ) => void;
  addInitialWorkspace: (workspaceType: string) => void;
  removeWorkspaceZone: (zoneId: ZoneId) => void;

  // Helpers
  findZone: (zoneId: ZoneId, root?: Zone) => Zone | null;
  findParent: (zoneId: ZoneId, root?: Zone, parent?: ContainerZone) => ContainerZone | null;
  cleanupEmptyContainers: () => void;
  validateLayout: () => boolean;
}

export const useLayoutStore = createWithEqualityFn<LayoutState>()(
  persist(
    (set, get) => ({
      layout: createInitialLayout(),
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

        // Обновить размер целевой зоны
        const newSizes = [...parent.sizes];
        newSizes[zoneIndex] = newSize;

        // Пересчитать остальные размеры пропорционально
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

        // Обновить контейнер
        const updatedParent: ContainerZone = {
          ...parent,
          sizes: newSizes,
        };

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

        // Проверка что количество размеров совпадает с количеством зон
        if (sizes.length !== container.zones.length) {
          return;
        }

        // Проверка что сумма размеров равна 100 (с небольшой погрешностью)
        const totalSize = sizes.reduce((sum, size) => sum + size, 0);
        if (Math.abs(totalSize - 100) > 0.01) {
          return;
        }

        // Обновить контейнер
        const updatedContainer: ContainerZone = {
          ...container,
          sizes,
        };

        const updatedLayout = { ...state.layout };
        updatedLayout.rootZone = updateZoneInTree(
          updatedLayout.rootZone,
          containerId,
          updatedContainer,
        );

        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
      },

      /**
       * @deprecated Prefer `addAdjacentWorkspace` or `addInitialWorkspace` for layout edit mode.
       */
      addZone: (parentId, workspaceId, workspaceType, _direction) => {
        const state = get();
        const parent = state.findZone(parentId);

        if (!parent || parent.type !== 'container') {
          return;
        }

        if (parent.zones.length >= MAX_ZONES_PER_CONTAINER) {
          return;
        }

        // Если direction не указан, использовать направление родителя
        // const newDirection = direction || parent.direction; // Не используется, но оставлено для будущего

        // Создать новую workspace зону
        const newZone: WorkspaceZone = {
          id: uuidv4(),
          type: 'workspace',
          workspaceId,
          workspaceType,
          size: 0, // будет пересчитано
        };

        // Добавить зону в контейнер
        const updatedZones = [...parent.zones, newZone];

        // Пересчитать размеры (равномерно распределить между всеми зонами)
        const newSizes = updatedZones.map(() => 100 / updatedZones.length);

        // Обновить размеры в новых зонах
        const updatedZonesWithSizes = updatedZones.map((zone, index) => {
          if (zone.id === newZone.id) {
            return { ...zone, size: newSizes[index] };
          }
          if (zone.type === 'workspace') {
            return { ...zone, size: newSizes[index] };
          }
          return zone;
        });

        // Обновить контейнер
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

      /**
       * @deprecated Prefer `removeWorkspaceZone` for layout edit mode.
       * Delegates to `removeWorkspaceZone`, which runs full workspace lifecycle cleanup
       * (UI store, project store, type registry) and may leave an empty layout when the
       * last zone is removed. No external callers outside this store (only interface + docs).
       */
      removeZone: (zoneId) => {
        get().removeWorkspaceZone(zoneId);
      },

      setZoneDirection: (containerId, direction) => {
        const state = get();
        const container = state.findZone(containerId);

        if (!container || container.type !== 'container') {
          return;
        }

        // Обновить контейнер
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
        const state = get();
        for (const zone of collectWorkspaceZones(state.layout.rootZone)) {
          cleanupWorkspaceInstance(zone);
        }

        const newLayout = createLayoutByPreset(preset);
        set({ layout: newLayout, openLayoutEditPickerKey: null });
      },

      addAdjacentWorkspace: (targetZoneId, side, workspaceType) => {
        const state = get();
        const result = addAdjacentWorkspaceToLayout(
          state.layout,
          targetZoneId,
          side,
          workspaceType,
        );

        if (!result.ok) {
          useUIStore.getState().addNotification({
            type: 'warning',
            message: getAddWorkspaceErrorMessage(result.reason),
          });
          return;
        }

        prepareWorkspaceInstance(result.preparedZone);
        set({ layout: result.layout });
        useUIStore.getState().addNotification({
          type: 'success',
          message: getWorkspaceAddedMessage(workspaceType),
        });
      },

      addInitialWorkspace: (workspaceType) => {
        const state = get();
        if (!isLayoutEmpty(state.layout)) {
          return;
        }

        const { layout, preparedZone } = addInitialWorkspaceToLayout(workspaceType);
        prepareWorkspaceInstance(preparedZone);
        set({ layout });
        useUIStore.getState().addNotification({
          type: 'success',
          message: getWorkspaceAddedMessage(workspaceType),
        });
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

        const shouldClearPicker =
          state.openLayoutEditPickerKey !== null &&
          state.openLayoutEditPickerKey.startsWith(`${zoneId}:`);

        set({
          layout: result.layout,
          ...(shouldClearPicker ? { openLayoutEditPickerKey: null } : {}),
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

        // Если rootZone изменился, обновить layout
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
        // Используем фиксированные размеры для валидации (можно улучшить, получая из DOM)
        // Для базовой валидации используем стандартные размеры окна
        const containerWidth = 1200;
        const containerHeight = 800;
        return validateLayout(state.layout.rootZone, containerWidth, containerHeight);
      },
    }),
    {
      name: 'cherryplaylist-layout',
      version: 3,
      storage: electronStorage,
      partialize: (state) => ({
        layout: state.layout,
      }),
      migrate: (persistedState: unknown, version: number) =>
        migratePersistedLayoutState(persistedState, version),
    },
  ),
);
