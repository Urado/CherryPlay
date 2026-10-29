import { createWithEqualityFn } from 'zustand/traditional';

import type { PartyEditorBlockedReason } from './partyEditorPhase';

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

export const resetEditorDemoState = (): void => {
  usePartyEditorDemoStore.getState().resetEditorDemoState();
};
