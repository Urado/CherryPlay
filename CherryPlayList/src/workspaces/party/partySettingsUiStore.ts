import { createWithEqualityFn } from 'zustand/traditional';

export type PartySettingsSection = 'about' | 'design' | 'danger';

export type PartyEditorSection = PartySettingsSection;

export interface PartySettingsUiState {
  previewDesignOpen: boolean;
  previewDisplayOpen: boolean;
  setPreviewDesignOpen: (open: boolean) => void;
  setPreviewDisplayOpen: (open: boolean) => void;
  togglePreviewDesignOpen: () => void;
  togglePreviewDisplayOpen: () => void;
  resetPartySettingsUiState: () => void;
}

const initialPartySettingsUiState = {
  previewDesignOpen: false,
  previewDisplayOpen: false,
};

export const usePartySettingsUiStore = createWithEqualityFn<PartySettingsUiState>((set) => ({
  ...initialPartySettingsUiState,

  setPreviewDesignOpen: (previewDesignOpen) =>
    set({ previewDesignOpen, ...(previewDesignOpen ? { previewDisplayOpen: false } : {}) }),
  setPreviewDisplayOpen: (previewDisplayOpen) =>
    set({ previewDisplayOpen, ...(previewDisplayOpen ? { previewDesignOpen: false } : {}) }),
  togglePreviewDesignOpen: () =>
    set((state) => ({
      previewDesignOpen: !state.previewDesignOpen,
      previewDisplayOpen: false,
    })),
  togglePreviewDisplayOpen: () =>
    set((state) => ({
      previewDisplayOpen: !state.previewDisplayOpen,
      previewDesignOpen: false,
    })),
  resetPartySettingsUiState: () => set({ ...initialPartySettingsUiState }),
}));

export function resetPartySettingsUiState(): void {
  usePartySettingsUiStore.getState().resetPartySettingsUiState();
}
