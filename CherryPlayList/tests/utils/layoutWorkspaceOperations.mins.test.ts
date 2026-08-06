import type { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import type { ContainerZone, Layout, WorkspaceZone } from '@core/types/layout';
import {
  addAdjacentWorkspaceToContainerLayout,
  addAdjacentWorkspaceToLayout,
  canAddAdjacentWorkspace,
  getAddWorkspaceErrorMessage,
} from '@shared/utils/layoutWorkspaceOperations';

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

function createWorkspaceZone(
  workspaceType: string,
  id = `${workspaceType}-zone`,
  size = 100,
): WorkspaceZone {
  return {
    id,
    type: 'workspace',
    workspaceId: `${workspaceType}-workspace`,
    workspaceType,
    size,
  };
}

function createWorkspaceLayout(workspaceType: string, id?: string): Layout {
  return {
    version: 1,
    rootZone: createWorkspaceZone(workspaceType, id),
  };
}

describe('layoutWorkspaceOperations min-size feasibility', () => {
  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    TEST_WORKSPACE_MODULES.forEach((module) => workspaceRegistry.register(module));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('addAdjacentWorkspaceToLayout', () => {
    it('adds a workspace when the current viewport can satisfy all mins (50/50)', () => {
      const layout = createWorkspaceLayout('playlist', 'playlist-1');

      // Horizontal proposed tree: 280/0.5 + 320/0.5 = 1200 min width.
      const result = addAdjacentWorkspaceToLayout(layout, 'playlist-1', 'right', 'player', {
        width: 1300,
        height: 400,
      });

      if (!result.ok) {
        throw new Error(`Expected add to succeed, got reason: ${result.reason}`);
      }
      expect(result.layout.rootZone.type).toBe('container');
    });

    it('rejects with min_size_violation when the split cannot satisfy mins on width', () => {
      const layout = createWorkspaceLayout('playlist', 'playlist-1');

      // Horizontal split [playlist, player]: min width = 280 + 320 = 600; width 500 < 600.
      const result = addAdjacentWorkspaceToLayout(layout, 'playlist-1', 'right', 'player', {
        width: 500,
        height: 400,
      });

      expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
    });

    it('rejects with min_size_violation when the split cannot satisfy mins on height', () => {
      const layout = createWorkspaceLayout('playlist', 'playlist-1');

      // Vertical split [playlist, player]: min height = 200 + 120 = 320; height 300 < 320.
      const result = addAdjacentWorkspaceToLayout(layout, 'playlist-1', 'bottom', 'player', {
        width: 1000,
        height: 300,
      });

      expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
    });

    it('skips the feasibility check when the viewport argument is omitted (opt-out)', () => {
      const layout = createWorkspaceLayout('playlist', 'playlist-1');

      const result = addAdjacentWorkspaceToLayout(layout, 'playlist-1', 'right', 'player');

      expect(result.ok).toBe(true);
    });

    it('rejects with min_size_violation when the viewport is null (conservative)', () => {
      const layout = createWorkspaceLayout('playlist', 'playlist-1');

      const result = addAdjacentWorkspaceToLayout(layout, 'playlist-1', 'right', 'player', null);

      expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
    });

    it('keeps existing failure reasons (singleton) ahead of the min check', () => {
      const layout = createWorkspaceLayout('player', 'player-1');

      const result = addAdjacentWorkspaceToLayout(layout, 'player-1', 'right', 'player', {
        width: 10,
        height: 10,
      });

      expect(result).toEqual({ ok: false, reason: 'duplicate_singleton' });
    });
  });

  describe('addAdjacentWorkspaceToContainerLayout', () => {
    const buildRowLayout = (): Layout => {
      const rootZone: ContainerZone = {
        id: 'row',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 50],
        zones: [
          createWorkspaceZone('playlist', 'playlist-1', 50),
          createWorkspaceZone('collection', 'collection-1', 50),
        ],
      };

      return { version: 1, rootZone };
    };

    it('adds a spanning workspace when the viewport can satisfy the proposed tree', () => {
      const result = addAdjacentWorkspaceToContainerLayout(
        buildRowLayout(),
        'row',
        'top',
        'player',
        {
          width: 1000,
          height: 700,
        },
      );

      expect(result.ok).toBe(true);
    });

    it('rejects with min_size_violation when the proposed tree cannot fit', () => {
      // Proposed vertical [player, row[playlist, collection]]:
      // min height = 120 + max(200, 150) = 320; height 300 < 320.
      const result = addAdjacentWorkspaceToContainerLayout(
        buildRowLayout(),
        'row',
        'top',
        'player',
        {
          width: 1000,
          height: 300,
        },
      );

      expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
    });

    it('rejects with min_size_violation when the viewport is null (conservative)', () => {
      const result = addAdjacentWorkspaceToContainerLayout(
        buildRowLayout(),
        'row',
        'top',
        'player',
        null,
      );

      expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
    });
  });

  describe('getAddWorkspaceErrorMessage', () => {
    it('returns a Russian message for min_size_violation', () => {
      expect(getAddWorkspaceErrorMessage('min_size_violation')).toBe(
        'Недостаточно места. Увеличьте окно или измените пропорции разделителями.',
      );
    });
  });

  describe('canAddAdjacentWorkspace', () => {
    it('returns false for a null viewport (parity with the conservative mutate probe)', () => {
      const layout = createWorkspaceLayout('playlist', 'playlist-1');

      expect(canAddAdjacentWorkspace(layout, 'playlist-1', 'right', ['player'], null)).toBe(false);
    });
  });
});
