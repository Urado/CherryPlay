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
export { useDemoPlayerFloatingVisibility } from './useDemoPlayerFloatingVisibility';
export { useDemoPlayerFloatingBounds } from './useDemoPlayerFloatingBounds';
export { useDemoPlayerFloatingDrag } from './useDemoPlayerFloatingDrag';
export { useDemoPlayerFloatingResize } from './useDemoPlayerFloatingResize';
export { useWindowMinSize } from './useWindowMinSize';
