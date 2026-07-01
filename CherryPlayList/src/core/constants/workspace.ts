import { v4 as uuidv4 } from 'uuid';

import { WorkspaceId, WorkspaceType } from '../../modules/dragDrop/types';

/**
 * Константы для workspace
 * В будущем это будет управляться через workspace manager
 */

// Временный ID для основного плейлиста (пока один плейлист)
// В будущем это будет генерироваться динамически
export const DEFAULT_PLAYLIST_WORKSPACE_ID: WorkspaceId = 'default-playlist-workspace';

// ID для player workspace
export const DEFAULT_PLAYER_WORKSPACE_ID: WorkspaceId = 'default-player-workspace';

// ID для party editor и preview workspaces
export const PARTY_EDITOR_WORKSPACE_ID: WorkspaceId = 'party-editor-workspace';
export const PARTY_PREVIEW_WORKSPACE_ID: WorkspaceId = 'party-preview-workspace';

// ID для AIMP workspace
export const AIMP_WORKSPACE_ID: WorkspaceId = 'aimp-workspace';

const workspaceTypeRegistry = new Map<WorkspaceId, WorkspaceType>();
workspaceTypeRegistry.set(DEFAULT_PLAYLIST_WORKSPACE_ID, 'playlist');
workspaceTypeRegistry.set(DEFAULT_PLAYER_WORKSPACE_ID, 'player');
workspaceTypeRegistry.set(PARTY_EDITOR_WORKSPACE_ID, 'party-editor');
workspaceTypeRegistry.set(PARTY_PREVIEW_WORKSPACE_ID, 'party-preview');
workspaceTypeRegistry.set(AIMP_WORKSPACE_ID, 'aimp');

/**
 * Генерирует новый UUID для workspace
 */
export function generateWorkspaceId(): WorkspaceId {
  return uuidv4();
}

/**
 * Проверяет, является ли операция cross-workspace
 */
export function isCrossWorkspaceOperation(
  sourceWorkspaceId: WorkspaceId | undefined,
  targetWorkspaceId: WorkspaceId | undefined,
): boolean {
  if (!sourceWorkspaceId || !targetWorkspaceId) {
    return false;
  }
  return sourceWorkspaceId !== targetWorkspaceId;
}

/**
 * Получает тип workspace по его ID
 * В будущем это будет извлекаться из workspace manager
 */
export function getWorkspaceType(workspaceId: WorkspaceId): WorkspaceType {
  return workspaceTypeRegistry.get(workspaceId) || 'playlist';
}

export function registerWorkspaceType(workspaceId: WorkspaceId, type: WorkspaceType): void {
  workspaceTypeRegistry.set(workspaceId, type);
}

export function unregisterWorkspaceType(workspaceId: WorkspaceId): void {
  if (workspaceId === DEFAULT_PLAYLIST_WORKSPACE_ID) {
    return;
  }
  workspaceTypeRegistry.delete(workspaceId);
}
