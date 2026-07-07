import {
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  DEFAULT_PLAYLIST_WORKSPACE_ID,
} from '../../src/core/constants/workspace';
import type { ContainerZone, Layout } from '../../src/core/types/layout';
import { computeIsWorkspaceDirty } from '../../src/shared/stores/layoutStore';
import { getLayoutZoneSignature } from '../../src/shared/utils/layoutSignature';
import {
  addAdjacentWorkspaceToLayout,
  addInitialWorkspaceToLayout,
  collectWorkspaceZones,
  countWorkspaceLeaves,
  createEmptyLayout,
  isLayoutEmpty,
  removeWorkspaceFromLayout,
} from '../../src/shared/utils/layoutWorkspaceOperations';

describe('layoutWorkspaceOperations core helpers', () => {
  const twoZoneLayout: Layout = {
    version: 1,
    rootZone: {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      sizes: [50, 50],
      zones: [
        {
          id: 'playlist-zone',
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 50,
        },
        {
          id: 'fb-zone',
          type: 'workspace',
          workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
          workspaceType: 'fileBrowser',
          size: 50,
        },
      ],
    },
  };

  describe('isLayoutEmpty', () => {
    it('returns true for empty layout', () => {
      expect(isLayoutEmpty(createEmptyLayout())).toBe(true);
    });

    it('returns false when workspace leaves exist', () => {
      expect(isLayoutEmpty(twoZoneLayout)).toBe(false);
    });
  });

  describe('addInitialWorkspaceToLayout', () => {
    it('creates a single workspace root', () => {
      const { layout, preparedZone } = addInitialWorkspaceToLayout('playlist');

      expect(layout.rootZone.type).toBe('workspace');
      expect(preparedZone.workspaceType).toBe('playlist');
      expect(countWorkspaceLeaves(layout.rootZone)).toBe(1);
    });
  });

  describe('removeWorkspaceFromLayout', () => {
    it('removes a zone and keeps the remaining workspace', () => {
      const result = removeWorkspaceFromLayout(twoZoneLayout, 'fb-zone');

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(countWorkspaceLeaves(result.layout.rootZone)).toBe(1);
      expect(result.removedZone.workspaceType).toBe('fileBrowser');
    });

    it('returns empty layout when removing the last workspace', () => {
      const singleLayout = addInitialWorkspaceToLayout('playlist').layout;
      const zoneId = singleLayout.rootZone.id;
      const result = removeWorkspaceFromLayout(singleLayout, zoneId);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(isLayoutEmpty(result.layout)).toBe(true);
    });
  });
});

describe('getLayoutZoneSignature', () => {
  it('includes container sizes so resize-only changes affect signature', () => {
    const before: Layout = {
      version: 1,
      rootZone: {
        id: 'root',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 50],
        zones: [
          {
            id: 'a',
            type: 'workspace',
            workspaceId: 'a-ws',
            workspaceType: 'playlist',
            size: 50,
          },
          {
            id: 'b',
            type: 'workspace',
            workspaceId: 'b-ws',
            workspaceType: 'fileBrowser',
            size: 50,
          },
        ],
      },
    };

    const after: Layout = {
      ...before,
      rootZone: {
        ...before.rootZone,
        sizes: [70, 30],
      },
    };

    expect(getLayoutZoneSignature(before.rootZone)).not.toBe(
      getLayoutZoneSignature(after.rootZone),
    );
  });
});

describe('computeIsWorkspaceDirty', () => {
  const baselineLayout: Layout = {
    version: 1,
    rootZone: {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      sizes: [50, 50],
      zones: [
        {
          id: 'playlist-zone',
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 50,
        },
        {
          id: 'fb-zone',
          type: 'workspace',
          workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
          workspaceType: 'fileBrowser',
          size: 50,
        },
      ],
    },
  };

  it('returns true when only container sizes change (resize)', () => {
    const resized: Layout = {
      ...baselineLayout,
      rootZone: {
        ...(baselineLayout.rootZone as ContainerZone),
        sizes: [70, 30],
      },
    };

    expect(computeIsWorkspaceDirty(resized, baselineLayout)).toBe(true);
    expect(computeIsWorkspaceDirty(baselineLayout, baselineLayout)).toBe(false);
  });

  it('returns false when baseline is null', () => {
    expect(computeIsWorkspaceDirty(baselineLayout, null)).toBe(false);
  });
});

describe('addAdjacentWorkspaceToLayout insert paths', () => {
  const horizontalTwoZoneLayout: Layout = {
    version: 1,
    rootZone: {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      sizes: [50, 50],
      zones: [
        {
          id: 'playlist-zone',
          type: 'workspace',
          workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
          workspaceType: 'playlist',
          size: 50,
        },
        {
          id: 'fb-zone',
          type: 'workspace',
          workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
          workspaceType: 'fileBrowser',
          size: 50,
        },
      ],
    },
  };

  it('inserts into same-direction parent when side is parallel', () => {
    const result = addAdjacentWorkspaceToLayout(
      horizontalTwoZoneLayout,
      'playlist-zone',
      'right',
      'collection',
    );

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (!result.ok) {
      return;
    }

    const root = result.layout.rootZone;
    expect(root.type).toBe('container');
    if (root.type !== 'container') {
      return;
    }

    expect(root.direction).toBe('horizontal');
    expect(root.zones).toHaveLength(3);
    expect(collectWorkspaceZones(root)).toHaveLength(3);
  });

  it('wraps target in a new split container when side is perpendicular', () => {
    const result = addAdjacentWorkspaceToLayout(
      horizontalTwoZoneLayout,
      'playlist-zone',
      'top',
      'collection',
    );

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (!result.ok) {
      return;
    }

    const root = result.layout.rootZone;
    expect(root.type).toBe('container');
    if (root.type !== 'container') {
      return;
    }

    expect(root.direction).toBe('horizontal');
    expect(root.zones).toHaveLength(2);
    expect(root.zones[0].type).toBe('container');
    if (root.zones[0].type !== 'container') {
      return;
    }

    expect(root.zones[0].direction).toBe('vertical');
    expect(countWorkspaceLeaves(root)).toBe(3);
  });
});
