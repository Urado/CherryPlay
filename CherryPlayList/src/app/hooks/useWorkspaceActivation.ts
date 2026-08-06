import { requestActivateWorkspace } from './useWorkspaceDirtyGuard';

export type { RequestActivateWorkspaceOptions } from './useWorkspaceDirtyGuard';

/**
 * Workspace activation entry point for header UI.
 * Silently auto-commits dirty layout via `requestActivateWorkspace` before switching.
 */
export function useWorkspaceActivation() {
  return { requestActivateWorkspace };
}
