import { createWithEqualityFn } from 'zustand/traditional';

export type PartySettingsSection = 'about' | 'design' | 'danger';

export type PartyEditorSection = PartySettingsSection;

export interface PartySettingsUiState {
  previewDesignOpen: boolean;
  setPreviewDesignOpen: (open: boolean) => void;
  togglePreviewDesignOpen: () => void;
  resetPartySettingsUiState: () => void;
}

const initialPartySettingsUiState = {
  previewDesignOpen: false,
};

export const usePartySettingsUiStore = createWithEqualityFn<PartySettingsUiState>((set) => ({
  ...initialPartySettingsUiState,

  setPreviewDesignOpen: (previewDesignOpen) => set({ previewDesignOpen }),
  togglePreviewDesignOpen: () => set((state) => ({ previewDesignOpen: !state.previewDesignOpen })),
  resetPartySettingsUiState: () => set({ ...initialPartySettingsUiState }),
}));

export function resetPartySettingsUiState(): void {
  usePartySettingsUiStore.getState().resetPartySettingsUiState();
}
