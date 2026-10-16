import { requestActivateWorkspace } from './useWorkspaceDirtyGuard';

export type { RequestActivateWorkspaceOptions } from './useWorkspaceDirtyGuard';

export const useWorkspaceActivation = () => {
  return { requestActivateWorkspace };
};
