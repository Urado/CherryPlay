import type { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import type { ContainerZone, Layout, WorkspaceZone } from '@core/types/layout';
import {
  computeMinLayoutSize,
  computeMinWindowSize,
  DEFAULT_WORKSPACE_MIN_SIZE,
  getMinSizePercentsForContainer,
  getWorkspaceMinSize,
} from '@shared/utils/layoutWorkspaceMins';
import { createEmptyLayout } from '@shared/utils/layoutWorkspaceOperations';
import { logger } from '@shared/utils/logger';

const stubWorkspaceComponent = () => null;

const TEST_WORKSPACE_MODULES: IWorkspaceModule[] = [
  {
    id: 'playlist-workspace',
    type: 'playlist',
    name: 'Playlist',
    component: stubWorkspaceComponent,
    minWidth: 280,
    minHeight: 200,
  },
  {
    id: 'player-workspace',
    type: 'player',
    name: 'Player',
    component: stubWorkspaceComponent,
    minWidth: 320,
    minHeight: 120,
  },
  {
    id: 'collection-workspace',
    type: 'collection',
    name: 'Collection',
    component: stubWorkspaceComponent,
    minWidth: 200,
    minHeight: 150,
  },
];

describe('layoutWorkspaceMins', () => {
  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    TEST_WORKSPACE_MODULES.forEach((module) => workspaceRegistry.register(module));
  });

  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createWorkspaceZone = (
    workspaceType: string,
    size: number,
    id = `${workspaceType}-zone`,
  ): WorkspaceZone => ({
    id,
    type: 'workspace',
    workspaceId: `${workspaceType}-workspace`,
    workspaceType,
    size,
  });

  describe('getWorkspaceMinSize', () => {
    it('returns registered workspace mins for a single type', () => {
      expect(getWorkspaceMinSize('playlist')).toEqual({ minWidth: 280, minHeight: 200 });
      expect(getWorkspaceMinSize('player')).toEqual({ minWidth: 320, minHeight: 120 });
    });

    it('normalizes aimp to player mins', () => {
      expect(getWorkspaceMinSize('aimp')).toEqual(getWorkspaceMinSize('player'));
    });

    it('falls back for unknown workspace types', () => {
      expect(getWorkspaceMinSize('unknown-workspace-type')).toEqual(DEFAULT_WORKSPACE_MIN_SIZE);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unknown-workspace-type'));
    });
  });

  describe('computeMinLayoutSize', () => {
    it('returns workspace type mins for a single workspace root', () => {
      const root = createWorkspaceZone('playlist', 100);
      expect(computeMinLayoutSize(root)).toEqual({ minWidth: 280, minHeight: 200 });
    });

    it('returns zero mins for an empty layout root container', () => {
      expect(computeMinLayoutSize(createEmptyLayout().rootZone)).toEqual({
        minWidth: 0,
        minHeight: 0,
      });
    });

    it('aggregates nested horizontal and vertical splits (min-content: sum on split axis, max on cross axis)', () => {
      const leftColumn: ContainerZone = {
        id: 'left-column',
        type: 'container',
        direction: 'vertical',
        sizes: [60, 40],
        zones: [createWorkspaceZone('playlist', 60), createWorkspaceZone('collection', 40)],
      };

      const root: ContainerZone = {
        id: 'root',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 50],
        zones: [leftColumn, createWorkspaceZone('player', 50)],
      };

      // leftColumn (vertical): minHeight = 200 + 150 = 350; minWidth = max(280, 200) = 280.
      // root (horizontal): minWidth = 280 + 320 = 600; minHeight = max(350, 120) = 350.
      expect(computeMinLayoutSize(root)).toEqual({
        minWidth: 600,
        minHeight: 350,
      });
    });

    it('uses player mins for legacy aimp leaves', () => {
      const root = createWorkspaceZone('aimp', 100);
      expect(computeMinLayoutSize(root)).toEqual({ minWidth: 320, minHeight: 120 });
    });
  });

  describe('getMinSizePercentsForContainer', () => {
    it('returns per-sibling min percents along the split axis', () => {
      const container: ContainerZone = {
        id: 'split',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 50],
        zones: [createWorkspaceZone('playlist', 50), createWorkspaceZone('player', 50)],
      };

      const percents = getMinSizePercentsForContainer(container, 1000, 800);
      expect(percents[0]).toBeCloseTo(28, 10);
      expect(percents[1]).toBe(32);
    });

    it('uses minHeight for vertical containers', () => {
      const container: ContainerZone = {
        id: 'vertical-split',
        type: 'container',
        direction: 'vertical',
        sizes: [60, 40],
        zones: [createWorkspaceZone('playlist', 60), createWorkspaceZone('collection', 40)],
      };

      expect(getMinSizePercentsForContainer(container, 1000, 800)).toEqual([25, 18.75]);
    });

    it('returns zeros when the split-axis container size is non-positive', () => {
      const container: ContainerZone = {
        id: 'collapsed',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 50],
        zones: [createWorkspaceZone('playlist', 50), createWorkspaceZone('player', 50)],
      };

      expect(getMinSizePercentsForContainer(container, 0, 800)).toEqual([0, 0]);
    });
  });

  describe('computeMinWindowSize', () => {
    it('adds chrome insets to layout viewport mins', () => {
      const layout: Layout = {
        version: 1,
        rootZone: createWorkspaceZone('playlist', 100),
      };

      expect(computeMinWindowSize(layout, { top: 48, bottom: 32, left: 0, right: 0 })).toEqual({
        minWidth: 280,
        minHeight: 280,
      });
    });

    it('returns chrome-only mins for an empty layout', () => {
      const layout = createEmptyLayout();

      expect(computeMinWindowSize(layout, { top: 10, bottom: 20, left: 5, right: 5 })).toEqual({
        minWidth: 10,
        minHeight: 30,
      });
    });
  });
});
