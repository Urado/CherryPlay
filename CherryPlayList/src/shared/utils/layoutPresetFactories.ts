import { v4 as uuidv4 } from 'uuid';

import type { LayoutPreset } from '@core/types/workspacePreset';

import {
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  DEFAULT_PLAYLIST_WORKSPACE_ID,
  DEFAULT_PLAYER_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  generateWorkspaceId,
} from '../../core/constants/workspace';
import type { ContainerZone, Layout, WorkspaceZone } from '../../core/types/layout';

import { setupCollectionZoneForPreset } from './workspaceLifecycle';

export function createSimpleLayout(): Layout {
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

function createCollectionsVerticalLayout(): Layout {
  const playlistZoneId = uuidv4();
  const fileBrowserZoneId = uuidv4();
  const collection1ZoneId = uuidv4();
  const collection2ZoneId = uuidv4();
  const verticalContainerId = uuidv4();
  const rootContainerId = uuidv4();

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

  setupCollectionZoneForPreset(collection1Zone, 'Подборка 1');
  setupCollectionZoneForPreset(collection2Zone, 'Подборка 2');

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

export function createCollectionsLayout(): Layout {
  const playlistZoneId = uuidv4();
  const fileBrowserZoneId = uuidv4();
  const collection1ZoneId = uuidv4();
  const collection2ZoneId = uuidv4();
  const horizontalContainerId = uuidv4();
  const verticalContainerId = uuidv4();
  const rootContainerId = uuidv4();

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

  setupCollectionZoneForPreset(collection1Zone, 'Подборка 1');
  setupCollectionZoneForPreset(collection2Zone, 'Подборка 2');

  const horizontalContainer: ContainerZone = {
    id: horizontalContainerId,
    type: 'container',
    direction: 'horizontal',
    zones: [collection1Zone, collection2Zone],
    sizes: [50, 50],
  };

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

export function createComplexLayout(): Layout {
  const playlistZoneId = uuidv4();
  const rootContainerId = uuidv4();

  const testZone1Id = uuidv4();
  const testZone2Id = uuidv4();
  const testZone3Id = uuidv4();
  const testZone4Id = uuidv4();
  const testZone5Id = uuidv4();
  const testZone6Id = uuidv4();
  const testZone7Id = uuidv4();
  const testZone8Id = uuidv4();

  const horizontalContainer1Id = uuidv4();
  const horizontalContainer2Id = uuidv4();
  const horizontalContainer3Id = uuidv4();
  const verticalContainerId = uuidv4();

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

  const verticalContainer: ContainerZone = {
    id: verticalContainerId,
    type: 'container',
    direction: 'vertical',
    zones: [horizontalContainer1, horizontalContainer2, horizontalContainer3],
    sizes: [33.33, 33.33, 33.34],
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

export function createPlayerLayout(): Layout {
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

export function createPartyLayout(): Layout {
  const playerZoneId = uuidv4();
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
          id: partyPreviewZoneId,
          type: 'workspace',
          workspaceId: PARTY_PREVIEW_WORKSPACE_ID,
          workspaceType: 'party-preview',
          size: 50,
        },
      ],
      sizes: [50, 50],
    },
    version: 1,
  };
}

function createAimpPartyLayout(): Layout {
  return createPartyLayout();
}

export function createLayoutByPreset(preset: LayoutPreset): Layout {
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

export function createInitialLayout(): Layout {
  return createCollectionsVerticalLayout();
}
