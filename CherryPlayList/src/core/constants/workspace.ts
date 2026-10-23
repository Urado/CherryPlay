import { v4 as uuidv4 } from 'uuid';

import { WorkspaceId, WorkspaceType } from '../../modules/dragDrop/types';

export const DEFAULT_PLAYLIST_WORKSPACE_ID: WorkspaceId = 'default-playlist-workspace';

export const DEFAULT_PLAYER_WORKSPACE_ID: WorkspaceId = 'default-player-workspace';
export const DEFAULT_DEMO_PLAYER_WORKSPACE_ID: WorkspaceId = 'default-demo-player-workspace';

export const PARTY_EDITOR_WORKSPACE_ID: WorkspaceId = 'party-editor-workspace';
export const PARTY_PREVIEW_WORKSPACE_ID: WorkspaceId = 'party-preview-workspace';

export const AIMP_WORKSPACE_ID: WorkspaceId = 'aimp-workspace';

export const DEFAULT_FILEBROWSER_WORKSPACE_ID: WorkspaceId = 'default-filebrowser-workspace';

const workspaceTypeRegistry = new Map<WorkspaceId, WorkspaceType>();
workspaceTypeRegistry.set(DEFAULT_PLAYLIST_WORKSPACE_ID, 'playlist');
workspaceTypeRegistry.set(DEFAULT_PLAYER_WORKSPACE_ID, 'player');
workspaceTypeRegistry.set(DEFAULT_DEMO_PLAYER_WORKSPACE_ID, 'demo-player');
workspaceTypeRegistry.set(PARTY_EDITOR_WORKSPACE_ID, 'party-editor');
workspaceTypeRegistry.set(PARTY_PREVIEW_WORKSPACE_ID, 'party-preview');
workspaceTypeRegistry.set(AIMP_WORKSPACE_ID, 'aimp');
workspaceTypeRegistry.set(DEFAULT_FILEBROWSER_WORKSPACE_ID, 'fileBrowser');

export const generateWorkspaceId = (): WorkspaceId => {
  return uuidv4();
};

export const isCrossWorkspaceOperation = (
  sourceWorkspaceId: WorkspaceId | undefined,
  targetWorkspaceId: WorkspaceId | undefined,
): boolean => {
  if (!sourceWorkspaceId || !targetWorkspaceId) {
    return false;
  }
  return sourceWorkspaceId !== targetWorkspaceId;
};

export const getWorkspaceType = (workspaceId: WorkspaceId): WorkspaceType => {
  return workspaceTypeRegistry.get(workspaceId) || 'playlist';
};

export const registerWorkspaceType = (workspaceId: WorkspaceId, type: WorkspaceType): void => {
  workspaceTypeRegistry.set(workspaceId, type);
};

export const unregisterWorkspaceType = (workspaceId: WorkspaceId): void => {
  if (
    workspaceId === DEFAULT_PLAYLIST_WORKSPACE_ID ||
    workspaceId === DEFAULT_FILEBROWSER_WORKSPACE_ID
  ) {
    return;
  }
  workspaceTypeRegistry.delete(workspaceId);
};
