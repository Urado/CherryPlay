import type { Layout } from '../../src/core/types/layout';
import { getLayoutPresetFromLayout } from '../../src/shared/utils/layoutPreset';

describe('getLayoutPresetFromLayout', () => {
  test('detects the persisted AIMP + Party preset from the layout tree', () => {
    const layout: Layout = {
      version: 1,
      rootZone: {
        id: 'root',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 25, 25],
        zones: [
          {
            id: 'aimp-zone',
            type: 'workspace',
            workspaceId: 'aimp-workspace',
            workspaceType: 'aimp',
            size: 50,
          },
          {
            id: 'party-editor-zone',
            type: 'workspace',
            workspaceId: 'party-editor-workspace',
            workspaceType: 'party-editor',
            size: 25,
          },
          {
            id: 'party-preview-zone',
            type: 'workspace',
            workspaceId: 'party-preview-workspace',
            workspaceType: 'party-preview',
            size: 25,
          },
        ],
      },
    };

    expect(getLayoutPresetFromLayout(layout)).toBe('aimp-party');
  });

  test('detects the persisted party preset from the layout tree', () => {
    const layout: Layout = {
      version: 1,
      rootZone: {
        id: 'root',
        type: 'container',
        direction: 'horizontal',
        sizes: [50, 25, 25],
        zones: [
          {
            id: 'player-zone',
            type: 'workspace',
            workspaceId: 'player-workspace',
            workspaceType: 'player',
            size: 50,
          },
          {
            id: 'party-editor-zone',
            type: 'workspace',
            workspaceId: 'party-editor-workspace',
            workspaceType: 'party-editor',
            size: 25,
          },
          {
            id: 'party-preview-zone',
            type: 'workspace',
            workspaceId: 'party-preview-workspace',
            workspaceType: 'party-preview',
            size: 25,
          },
        ],
      },
    };

    expect(getLayoutPresetFromLayout(layout)).toBe('party');
  });

  test('returns null for layouts that no longer match a known preset', () => {
    const layout: Layout = {
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
            workspaceId: 'playlist-workspace',
            workspaceType: 'playlist',
            size: 50,
          },
          {
            id: 'party-editor-zone',
            type: 'workspace',
            workspaceId: 'party-editor-workspace',
            workspaceType: 'party-editor',
            size: 50,
          },
        ],
      },
    };

    expect(getLayoutPresetFromLayout(layout)).toBeNull();
  });
});
