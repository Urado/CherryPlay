import {
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  getWorkspaceType,
} from '../../src/core/constants/workspace';
import type { Layout, WorkspaceZone } from '../../src/core/types/layout';
import { useSettingsStore } from '../../src/shared/stores/settingsStore';
import {
  addAdjacentWorkspaceToLayout,
  collectWorkspaceZones,
  createWorkspaceZone,
  isSingletonWorkspaceType,
  migrateDuplicateFileBrowserWorkspaceIds,
  resolveWorkspaceIdForType,
} from '../../src/shared/utils/layoutWorkspaceOperations';
import {
  cleanupWorkspaceInstance,
  prepareWorkspaceInstance,
} from '../../src/shared/utils/workspaceLifecycle';

function createLayoutWithFileBrowser(): { layout: Layout; zone: WorkspaceZone } {
  const zone: WorkspaceZone = {
    id: 'fb-zone-1',
    type: 'workspace',
    workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
    workspaceType: 'fileBrowser',
    size: 100,
  };

  return {
    layout: { version: 1, rootZone: zone },
    zone,
  };
}

describe('layoutWorkspaceOperations fileBrowser multi-instance', () => {
  it('treats fileBrowser as a non-singleton workspace type', () => {
    expect(isSingletonWorkspaceType('fileBrowser')).toBe(false);
  });

  it('assigns a unique workspaceId for new fileBrowser zones', () => {
    const id1 = resolveWorkspaceIdForType('fileBrowser');
    const id2 = resolveWorkspaceIdForType('fileBrowser');

    expect(id1).not.toBe(DEFAULT_FILEBROWSER_WORKSPACE_ID);
    expect(id2).not.toBe(id1);
  });

  it('createWorkspaceZone generates unique fileBrowser workspace ids', () => {
    const zone1 = createWorkspaceZone('fileBrowser');
    const zone2 = createWorkspaceZone('fileBrowser');

    expect(zone1.workspaceId).not.toBe(zone2.workspaceId);
    expect(zone1.workspaceId).not.toBe(DEFAULT_FILEBROWSER_WORKSPACE_ID);
  });

  it('allows adding a second fileBrowser zone adjacent to an existing one', () => {
    const { layout, zone } = createLayoutWithFileBrowser();
    const result = addAdjacentWorkspaceToLayout(layout, zone.id, 'right', 'fileBrowser');

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (!result.ok) {
      return;
    }

    const fileBrowserZones = collectWorkspaceZones(result.layout.rootZone).filter(
      (item) => item.workspaceType === 'fileBrowser',
    );

    expect(fileBrowserZones).toHaveLength(2);
    const workspaceIds = fileBrowserZones.map((item) => item.workspaceId);
    expect(new Set(workspaceIds).size).toBe(2);
  });

  it('migrates duplicate default fileBrowser workspace ids on hydrate', () => {
    const layout: Layout = {
      version: 1,
      rootZone: {
        id: 'root',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 50],
        zones: [
          {
            id: 'fb-1',
            type: 'workspace',
            workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
            workspaceType: 'fileBrowser',
            size: 50,
          },
          {
            id: 'fb-2',
            type: 'workspace',
            workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
            workspaceType: 'fileBrowser',
            size: 50,
          },
        ],
      },
    };

    const migrated = migrateDuplicateFileBrowserWorkspaceIds(layout);
    const fileBrowserZones = collectWorkspaceZones(migrated.rootZone).filter(
      (item) => item.workspaceType === 'fileBrowser',
    );

    expect(fileBrowserZones[0]?.workspaceId).toBe(DEFAULT_FILEBROWSER_WORKSPACE_ID);
    expect(fileBrowserZones[1]?.workspaceId).not.toBe(DEFAULT_FILEBROWSER_WORKSPACE_ID);
    expect(fileBrowserZones[0]?.workspaceId).not.toBe(fileBrowserZones[1]?.workspaceId);
  });
});

describe('workspaceLifecycle fileBrowser', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      fileBrowserPath: '',
      fileBrowserPathsByWorkspaceId: {},
    });
  });

  it('removes persisted path when a fileBrowser zone is cleaned up', () => {
    const workspaceId = 'filebrowser-workspace-cleanup';
    const zone: WorkspaceZone = {
      id: 'fb-zone-cleanup',
      type: 'workspace',
      workspaceId,
      workspaceType: 'fileBrowser',
      size: 50,
    };

    useSettingsStore.getState().setFileBrowserPathForWorkspace(workspaceId, '/music/test');
    prepareWorkspaceInstance(zone);
    cleanupWorkspaceInstance(zone);

    expect(useSettingsStore.getState().getFileBrowserPathForWorkspace(workspaceId)).toBe('');
    expect(workspaceId in useSettingsStore.getState().fileBrowserPathsByWorkspaceId).toBe(false);
  });

  it('keeps default fileBrowser workspace type registered after cleanup', () => {
    const zone: WorkspaceZone = {
      id: 'fb-zone-default',
      type: 'workspace',
      workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
      workspaceType: 'fileBrowser',
      size: 50,
    };

    prepareWorkspaceInstance(zone);
    cleanupWorkspaceInstance(zone);

    expect(getWorkspaceType(DEFAULT_FILEBROWSER_WORKSPACE_ID)).toBe('fileBrowser');
  });

  it('clears legacy fileBrowserPath when default zone is cleaned up', () => {
    const zone: WorkspaceZone = {
      id: 'fb-zone-legacy',
      type: 'workspace',
      workspaceId: DEFAULT_FILEBROWSER_WORKSPACE_ID,
      workspaceType: 'fileBrowser',
      size: 50,
    };

    useSettingsStore.setState({
      fileBrowserPath: '/legacy/music',
      fileBrowserPathsByWorkspaceId: {},
    });

    cleanupWorkspaceInstance(zone);

    expect(useSettingsStore.getState().fileBrowserPath).toBe('');
    expect(
      useSettingsStore.getState().getFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID),
    ).toBe('');
  });
});
