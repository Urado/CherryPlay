import type { ContainerZone, Layout, WorkspaceZone } from '../../src/core/types/layout';
import {
  migrateLegacyPartyLayout,
  migratePersistedLayoutState,
} from '../../src/shared/stores/layoutStore';
import { getLayoutPresetFromLayout } from '../../src/shared/utils/layoutPreset';

function createLegacyPartyLayout(): Layout {
  return {
    version: 1,
    rootZone: {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      sizes: [60, 40],
      zones: [
        {
          id: 'player-zone',
          type: 'workspace',
          workspaceId: 'player-workspace',
          workspaceType: 'player',
          size: 60,
        },
        {
          id: 'party-zone',
          type: 'workspace',
          workspaceId: 'party-workspace',
          workspaceType: 'party',
          size: 40,
        },
      ],
    },
  };
}

function createLegacyAimpPartyLayout(): Layout {
  return {
    version: 1,
    rootZone: {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      sizes: [60, 40],
      zones: [
        {
          id: 'aimp-zone',
          type: 'workspace',
          workspaceId: 'aimp-workspace',
          workspaceType: 'aimp',
          size: 60,
        },
        {
          id: 'party-zone',
          type: 'workspace',
          workspaceId: 'party-workspace',
          workspaceType: 'party',
          size: 40,
        },
      ],
    },
  };
}

function getWorkspaceTypes(root: ContainerZone): string[] {
  return root.zones
    .filter((zone): zone is WorkspaceZone => zone.type === 'workspace')
    .map((zone) => zone.workspaceType);
}

describe('layout persist migration v3', () => {
  test('migrates legacy party preset to editor + preview workspaces', () => {
    const migrated = migrateLegacyPartyLayout(createLegacyPartyLayout());

    expect(getLayoutPresetFromLayout(migrated)).toBe('party');
    const root = migrated.rootZone as ContainerZone;
    expect(getWorkspaceTypes(root)).toEqual(['player', 'party-editor', 'party-preview']);
  });

  test('migrates legacy aimp-party preset to editor + preview workspaces', () => {
    const migrated = migrateLegacyPartyLayout(createLegacyAimpPartyLayout());

    expect(getLayoutPresetFromLayout(migrated)).toBe('aimp-party');
    const root = migrated.rootZone as ContainerZone;
    expect(getWorkspaceTypes(root)).toEqual(['aimp', 'party-editor', 'party-preview']);
  });

  test('migratePersistedLayoutState upgrades persisted state below v3', () => {
    const legacy = { layout: createLegacyPartyLayout() };
    const result = migratePersistedLayoutState(legacy, 2);

    expect(getLayoutPresetFromLayout(result.layout)).toBe('party');
  });

  test('migratePersistedLayoutState leaves v3+ state unchanged', () => {
    const current = { layout: migrateLegacyPartyLayout(createLegacyPartyLayout()) };
    const result = migratePersistedLayoutState(current, 3);

    expect(result).toBe(current);
    expect(getLayoutPresetFromLayout(result.layout)).toBe('party');
  });
});
