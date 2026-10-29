import { create } from 'zustand';

interface ClientOutdatedState {
  isOutdated: boolean;
  requiredVersion: string | null;
  markOutdated: (requiredVersion?: string) => void;
  resetOutdated: () => void;
}

export const useClientOutdatedStore = create<ClientOutdatedState>((set) => ({
  isOutdated: false,
  requiredVersion: null,
  markOutdated: (requiredVersion) =>
    set((state) => {
      const version =
        typeof requiredVersion === 'string' && requiredVersion.trim() !== ''
          ? requiredVersion.trim()
          : state.requiredVersion;

      if (state.isOutdated) {
        return { requiredVersion: version };
      }

      return { isOutdated: true, requiredVersion: version };
    }),
  resetOutdated: () => set({ isOutdated: false, requiredVersion: null }),
}));

export const notifyClientOutdated = (requiredVersion?: string): void => {
  useClientOutdatedStore.getState().markOutdated(requiredVersion);
};

export const isClientOutdated = (): boolean => {
  return useClientOutdatedStore.getState().isOutdated;
};

export const resetClientOutdatedState = (): void => {
  useClientOutdatedStore.getState().resetOutdated();
};
