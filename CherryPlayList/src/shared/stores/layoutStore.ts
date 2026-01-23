import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { WorkspaceId } from '@core/types/workspace';

import {
  DEFAULT_PLAYLIST_WORKSPACE_ID,
  DEFAULT_PLAYER_WORKSPACE_ID,
  PARTY_WORKSPACE_ID,
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
import {
  findZoneById,
  findParentZone,
  cleanupContainers,
  validateLayout,
} from '../utils/layoutUtils';

import { electronStorage } from '../storage/electronStorage';
import { ensureProjectStore } from './projectStoreFactory';
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
          workspaceId: 'default-filebrowser-workspace',
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

  // Создаём stores для коллекций
  ensureProjectStore({
    workspaceId: collection1WorkspaceId,
    initialName: 'Collection 1',
    persist: true,
    supportsGroups: false,
    maxItems: null,
  });

  ensureProjectStore({
    workspaceId: collection2WorkspaceId,
    initialName: 'Collection 2',
    persist: true,
    supportsGroups: false,
    maxItems: null,
  });

  // Регистрируем коллекции в UI store
  const uiStore = useUIStore.getState();
  uiStore.addWorkspace({
    id: collection1WorkspaceId,
    type: 'collection',
    name: 'Collection 1',
  });
  uiStore.addWorkspace({
    id: collection2WorkspaceId,
    type: 'collection',
    name: 'Collection 2',
  });

  // Вертикальный контейнер с двумя коллекциями
  const verticalContainer: ContainerZone = {
    id: verticalContainerId,
    type: 'container',
    direction: 'vertical',
    zones: [
      {
        id: collection1ZoneId,
        type: 'workspace',
        workspaceId: collection1WorkspaceId,
        workspaceType: 'collection',
        size: 50,
      },
      {
        id: collection2ZoneId,
        type: 'workspace',
        workspaceId: collection2WorkspaceId,
        workspaceType: 'collection',
        size: 50,
      },
    ],
    sizes: [50, 50],
  };

  // Связываем zoneId с workspace
  uiStore.setWorkspaceZoneId(collection1WorkspaceId, collection1ZoneId);
  uiStore.setWorkspaceZoneId(collection2WorkspaceId, collection2ZoneId);

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
          workspaceId: 'default-filebrowser-workspace',
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

  // Создаём stores для коллекций
  ensureProjectStore({
    workspaceId: collection1WorkspaceId,
    initialName: 'Collection 1',
    persist: true,
    supportsGroups: false,
    maxItems: null,
  });

  ensureProjectStore({
    workspaceId: collection2WorkspaceId,
    initialName: 'Collection 2',
    persist: true,
    supportsGroups: false,
    maxItems: null,
  });

  // Регистрируем коллекции в UI store
  const uiStore = useUIStore.getState();
  uiStore.addWorkspace({
    id: collection1WorkspaceId,
    type: 'collection',
    name: 'Collection 1',
  });
  uiStore.addWorkspace({
    id: collection2WorkspaceId,
    type: 'collection',
    name: 'Collection 2',
  });

  // Горизонтальный контейнер с двумя коллекциями
  const horizontalContainer: ContainerZone = {
    id: horizontalContainerId,
    type: 'container',
    direction: 'horizontal',
    zones: [
      {
        id: collection1ZoneId,
        type: 'workspace',
        workspaceId: collection1WorkspaceId,
        workspaceType: 'collection',
        size: 50,
      },
      {
        id: collection2ZoneId,
        type: 'workspace',
        workspaceId: collection2WorkspaceId,
        workspaceType: 'collection',
        size: 50,
      },
    ],
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
        workspaceId: 'default-filebrowser-workspace',
        workspaceType: 'fileBrowser',
        size: 50,
      },
    ],
    sizes: [50, 50],
  };

  // Связываем zoneId с workspace
  uiStore.setWorkspaceZoneId(collection1WorkspaceId, collection1ZoneId);
  uiStore.setWorkspaceZoneId(collection2WorkspaceId, collection2ZoneId);

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
export type LayoutPreset = 'simple' | 'complex' | 'collections' | 'collections-vertical' | 'player' | 'party';

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
          workspaceId: 'default-filebrowser-workspace',
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
 *   - Player workspace (60%) - слева плеер
 *   - Party workspace (40%) - справа создание вечеринки с превью
 */
function createPartyLayout(): Layout {
  const playerZoneId = uuidv4();
  const partyZoneId = uuidv4();
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
          size: 60,
        },
        {
          id: partyZoneId,
          type: 'workspace',
          workspaceId: PARTY_WORKSPACE_ID,
          workspaceType: 'party',
          size: 40,
        },
      ],
      sizes: [60, 40],
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
    default:
      return createSimpleLayout();
  }
}

/**
 * Создает начальный layout (по умолчанию с коллекциями)
 */
function createInitialLayout(): Layout {
  return createCollectionsLayout();
}

interface LayoutState {
  layout: Layout;

  // Actions
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

        // Обновить layout
        const updatedLayout = { ...state.layout };
        const updateZoneInTree = (zone: Zone): Zone => {
          if (zone.id === parent.id) {
            return updatedParent;
          }
          if (zone.type === 'container') {
            return {
              ...zone,
              zones: zone.zones.map(updateZoneInTree),
            };
          }
          return zone;
        };

        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone);

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

        // Обновить layout
        const updatedLayout = { ...state.layout };
        const updateZoneInTree = (zone: Zone): Zone => {
          if (zone.id === containerId) {
            return updatedContainer;
          }
          if (zone.type === 'container') {
            return {
              ...zone,
              zones: zone.zones.map(updateZoneInTree),
            };
          }
          return zone;
        };

        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone);

        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
      },

      addZone: (parentId, workspaceId, workspaceType, _direction) => {
        const state = get();
        const parent = state.findZone(parentId);

        if (!parent || parent.type !== 'container') {
          return;
        }

        // Проверка что в контейнере меньше 10 зон
        if (parent.zones.length >= 10) {
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

        // Обновить layout
        const updatedLayout = { ...state.layout };
        const updateZoneInTree = (zone: Zone): Zone => {
          if (zone.id === parentId) {
            return updatedParent;
          }
          if (zone.type === 'container') {
            return {
              ...zone,
              zones: zone.zones.map(updateZoneInTree),
            };
          }
          return zone;
        };

        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone);

        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
      },

      removeZone: (zoneId) => {
        const state = get();
        const parent = state.findParent(zoneId);

        if (!parent) {
          return;
        }

        // Удалить зону из массива
        const updatedZones = parent.zones.filter((z) => z.id !== zoneId);

        // Если осталась только 1 зона, удаление не выполняется (будет обработано cleanupEmptyContainers)
        if (updatedZones.length < 2) {
          return;
        }

        // Пересчитать размеры для оставшихся зон (равномерно)
        const newSizes = updatedZones.map(() => 100 / updatedZones.length);

        // Обновить размеры в оставшихся зонах
        const updatedZonesWithSizes = updatedZones.map((zone, index) => {
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

        // Обновить layout
        const updatedLayout = { ...state.layout };
        const updateZoneInTree = (zone: Zone): Zone => {
          if (zone.id === parent.id) {
            return updatedParent;
          }
          if (zone.type === 'container') {
            return {
              ...zone,
              zones: zone.zones.map(updateZoneInTree),
            };
          }
          return zone;
        };

        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone);

        set({ layout: updatedLayout });
        get().cleanupEmptyContainers();
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

        // Обновить layout
        const updatedLayout = { ...state.layout };
        const updateZoneInTree = (zone: Zone): Zone => {
          if (zone.id === containerId) {
            return updatedContainer;
          }
          if (zone.type === 'container') {
            return {
              ...zone,
              zones: zone.zones.map(updateZoneInTree),
            };
          }
          return zone;
        };

        updatedLayout.rootZone = updateZoneInTree(updatedLayout.rootZone);

        set({ layout: updatedLayout });
      },

      replaceLayout: (newLayout) => {
        set({ layout: newLayout });
      },

      setLayoutPreset: (preset) => {
        const newLayout = createLayoutByPreset(preset);
        set({ layout: newLayout });
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
      version: 2, // Увеличена версия для сброса старого layout и применения нового с тестовыми зонами
      storage: electronStorage, // Используем localforage вместо localStorage
      partialize: (state) => ({
        // Сохраняем только layout, исключаем все методы
        layout: state.layout,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // При изменении версии сбрасываем layout и используем новый
        if (version === 2) {
          return { layout: createInitialLayout() };
        }
        return persistedState as { layout: Layout };
      },
    },
  ),
);
