import {
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  generateWorkspaceId,
} from '../../src/core/constants/workspace';
import type { Layout } from '../../src/core/types/layout';
import { resolveFileBrowserFocusTarget } from '../../src/shared/utils/resolveFileBrowserFocusTarget';

function createTwoFileBrowserLayout(firstWorkspaceId: string, secondWorkspaceId: string): Layout {
  return {
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
          workspaceId: firstWorkspaceId,
          workspaceType: 'fileBrowser',
          size: 50,
        },
        {
          id: 'fb-2',
          type: 'workspace',
          workspaceId: secondWorkspaceId,
          workspaceType: 'fileBrowser',
          size: 50,
        },
      ],
    },
  };
}

describe('resolveFileBrowserFocusTarget', () => {
  it('returns null when layout has no fileBrowser zones', () => {
    const layout: Layout = {
      version: 1,
      rootZone: {
        id: 'playlist',
        type: 'workspace',
        workspaceId: 'playlist-1',
        workspaceType: 'playlist',
        size: 100,
      },
    };

    expect(resolveFileBrowserFocusTarget(layout, { path: '/music/song.mp3' })).toBeNull();
  });

  it('uses explicit targetWorkspaceId when that zone exists in layout', () => {
    const secondId = generateWorkspaceId();
    const layout = createTwoFileBrowserLayout(DEFAULT_FILEBROWSER_WORKSPACE_ID, secondId);

    expect(
      resolveFileBrowserFocusTarget(layout, {
        path: '/music/song.mp3',
        targetWorkspaceId: secondId,
      }),
    ).toBe(secondId);
  });

  it('falls back to default workspace id when explicit target is missing from layout', () => {
    const secondId = generateWorkspaceId();
    const layout = createTwoFileBrowserLayout(DEFAULT_FILEBROWSER_WORKSPACE_ID, secondId);
    const unknownId = generateWorkspaceId();

    expect(
      resolveFileBrowserFocusTarget(layout, {
        path: '/music/song.mp3',
        targetWorkspaceId: unknownId,
      }),
    ).toBe(DEFAULT_FILEBROWSER_WORKSPACE_ID);
  });

  it('prefers default workspace id when no explicit target is provided', () => {
    const secondId = generateWorkspaceId();
    const layout = createTwoFileBrowserLayout(DEFAULT_FILEBROWSER_WORKSPACE_ID, secondId);

    expect(resolveFileBrowserFocusTarget(layout, { path: '/music/song.mp3' })).toBe(
      DEFAULT_FILEBROWSER_WORKSPACE_ID,
    );
  });

  it('returns first fileBrowser zone when default id is not in layout', () => {
    const firstId = generateWorkspaceId();
    const secondId = generateWorkspaceId();
    const layout = createTwoFileBrowserLayout(firstId, secondId);

    expect(resolveFileBrowserFocusTarget(layout, { path: '/music/song.mp3' })).toBe(firstId);
  });
});
