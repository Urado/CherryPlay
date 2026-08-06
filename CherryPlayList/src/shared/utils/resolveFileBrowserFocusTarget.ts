import { DEFAULT_FILEBROWSER_WORKSPACE_ID } from '@core/constants/workspace';
import type { Layout } from '@core/types/layout';
import type { WorkspaceId } from '@core/types/workspace';

import { collectWorkspaceZones } from './layoutWorkspaceOperations';

export interface FileBrowserFocusRequestInput {
  path: string;
  targetWorkspaceId?: WorkspaceId;
}

/**
 * Resolves which fileBrowser panel should handle a focus request.
 * Order: explicit target (if zone exists) → default workspace id → first fileBrowser zone.
 */
export function resolveFileBrowserFocusTarget(
  layout: Layout,
  request: FileBrowserFocusRequestInput,
): WorkspaceId | null {
  const fileBrowserZones = collectWorkspaceZones(layout.rootZone).filter(
    (zone) => zone.workspaceType === 'fileBrowser',
  );

  if (fileBrowserZones.length === 0) {
    return null;
  }

  if (request.targetWorkspaceId) {
    const explicitMatch = fileBrowserZones.find(
      (zone) => zone.workspaceId === request.targetWorkspaceId,
    );
    if (explicitMatch) {
      return explicitMatch.workspaceId;
    }
  }

  const defaultZone = fileBrowserZones.find(
    (zone) => zone.workspaceId === DEFAULT_FILEBROWSER_WORKSPACE_ID,
  );
  if (defaultZone) {
    return defaultZone.workspaceId;
  }

  return fileBrowserZones[0].workspaceId;
}
