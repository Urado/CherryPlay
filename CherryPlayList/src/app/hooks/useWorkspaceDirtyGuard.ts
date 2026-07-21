import type { WorkspaceRef } from '@core/types/workspacePreset';
import { useLayoutStore } from '@shared/stores';

export interface RequestActivateWorkspaceOptions {
  /** Skip auto-commit before switch (e.g. automatic AIMP/settings fallback). */
  bypassDirtyGuard?: boolean;
}

function isSameWorkspace(
  active: ReturnType<typeof useLayoutStore.getState>['activeWorkspace'],
  ref: WorkspaceRef,
): boolean {
  if (ref.kind === 'builtin') {
    return active.kind === 'builtin' && active.preset === ref.preset;
  }
  return active.kind === 'user' && active.id === ref.id;
}

export function requestActivateWorkspace(
  ref: WorkspaceRef,
  options?: RequestActivateWorkspaceOptions,
): boolean {
  const state = useLayoutStore.getState();
  if (state.isLayoutEditMode) {
    return false;
  }

  if (isSameWorkspace(state.activeWorkspace, ref)) {
    return true;
  }

  if (!options?.bypassDirtyGuard && state.isWorkspaceDirty()) {
    state.autoCommitWorkspaceChanges();
  }

  return useLayoutStore.getState().activateWorkspace(ref);
}

export function requestCreateScratchWorkspace(): boolean {
  const state = useLayoutStore.getState();
  if (state.isLayoutEditMode) {
    return false;
  }

  if (state.activeWorkspace.kind === 'scratch' && !state.isWorkspaceDirty()) {
    return true;
  }

  if (state.isWorkspaceDirty()) {
    state.autoCommitWorkspaceChanges();
  }

  return useLayoutStore.getState().createScratchWorkspace();
}

export function requestExitEditMode(): void {
  const state = useLayoutStore.getState();
  if (!state.isLayoutEditMode) {
    return;
  }

  if (state.isWorkspaceDirty()) {
    state.autoCommitWorkspaceChanges();
  }

  state.setLayoutEditMode(false);
}

export function requestToggleLayoutEditMode(): void {
  const state = useLayoutStore.getState();
  if (!state.isLayoutEditMode) {
    state.setLayoutEditMode(true);
    return;
  }
  requestExitEditMode();
}
