import {
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  DEFAULT_PLAYLIST_WORKSPACE_ID,
} from '../../src/core/constants/workspace';
import type { Layout } from '../../src/core/types/layout';
import {
  addAdjacentWorkspaceToContainerLayout,
  collectWorkspaceZones,
} from '../../src/shared/utils/layoutWorkspaceOperations';

function createHorizontalTwoZoneLayout(): { layout: Layout; containerId: string } {
  const containerId = 'root-horizontal';
  return {
    containerId,
    layout: {
      version: 1,
      rootZone: {
        id: containerId,
        type: 'container',
        direction: 'horizontal',
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
        sizes: [50, 50],
      },
    },
  };
}

describe('addAdjacentWorkspaceToContainerLayout', () => {
  it('wraps a horizontal row with a new zone above', () => {
    const { layout, containerId } = createHorizontalTwoZoneLayout();
    const result = addAdjacentWorkspaceToContainerLayout(layout, containerId, 'top', 'collection');

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (!result.ok) {
      return;
    }

    expect(result.layout.rootZone.type).toBe('container');
    if (result.layout.rootZone.type !== 'container') {
      return;
    }

    expect(result.layout.rootZone.direction).toBe('vertical');
    expect(result.layout.rootZone.zones).toHaveLength(2);
    expect(result.layout.rootZone.zones[0].type).toBe('workspace');
    expect(result.layout.rootZone.zones[1].type).toBe('container');

    const leaves = collectWorkspaceZones(result.layout.rootZone);
    expect(leaves).toHaveLength(3);
  });

  it('wraps a horizontal row with a new zone below', () => {
    const { layout, containerId } = createHorizontalTwoZoneLayout();
    const result = addAdjacentWorkspaceToContainerLayout(
      layout,
      containerId,
      'bottom',
      'collection',
    );

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (!result.ok) {
      return;
    }

    expect(result.layout.rootZone.type).toBe('container');
    if (result.layout.rootZone.type !== 'container') {
      return;
    }

    expect(result.layout.rootZone.direction).toBe('vertical');
    expect(result.layout.rootZone.zones[0].type).toBe('container');
    expect(result.layout.rootZone.zones[1].type).toBe('workspace');
  });

  it('rejects parallel sides for horizontal containers', () => {
    const { layout, containerId } = createHorizontalTwoZoneLayout();
    const result = addAdjacentWorkspaceToContainerLayout(layout, containerId, 'left', 'collection');

    expect(result).toEqual({ ok: false, reason: 'invalid_side' });
  });

  it('rejects containers with a single child', () => {
    const layout: Layout = {
      version: 1,
      rootZone: {
        id: 'solo-container',
        type: 'container',
        direction: 'horizontal',
        zones: [
          {
            id: 'only-zone',
            type: 'workspace',
            workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
            workspaceType: 'playlist',
            size: 100,
          },
        ],
        sizes: [100],
      },
    };

    const result = addAdjacentWorkspaceToContainerLayout(
      layout,
      'solo-container',
      'top',
      'collection',
    );

    expect(result).toEqual({ ok: false, reason: 'single_zone' });
  });
});
