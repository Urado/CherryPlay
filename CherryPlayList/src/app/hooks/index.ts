// App-specific hooks
// Global shortcuts have been moved to @shared/shortcuts module

export { useWorkspaceActivation } from './useWorkspaceActivation';
export {
  requestActivateWorkspace,
  requestCreateScratchWorkspace,
  requestExitEditMode,
  requestToggleLayoutEditMode,
} from './useWorkspaceDirtyGuard';
export type { RequestActivateWorkspaceOptions } from './useWorkspaceDirtyGuard';
