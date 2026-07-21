import { createWithEqualityFn } from 'zustand/traditional';

import type { PartyEditorBlockedReason } from './partyEditorPhase';

/**
 * Editor demo overlay state — reversible blocked-reason simulation in demo mode only.
 * Does not affect production auth/server state or preview scenario store.
 */
export interface PartyEditorDemoState {
  blockedOverride: PartyEditorBlockedReason | null;
  setBlockedOverride: (value: PartyEditorBlockedReason | null) => void;
  resetEditorDemoState: () => void;
}

const initialPartyEditorDemoState = {
  blockedOverride: null as PartyEditorBlockedReason | null,
};

export const usePartyEditorDemoStore = createWithEqualityFn<PartyEditorDemoState>((set) => ({
  ...initialPartyEditorDemoState,

  setBlockedOverride: (blockedOverride) => set({ blockedOverride }),
  resetEditorDemoState: () => set({ ...initialPartyEditorDemoState }),
}));

export function resetEditorDemoState(): void {
  usePartyEditorDemoStore.getState().resetEditorDemoState();
}
