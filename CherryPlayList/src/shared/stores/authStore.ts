import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { electronStorage } from '../storage/electronStorage';

interface Organizer {
  id: string;
  name: string;
}

interface AuthState {
  accessToken: string | null;
  organizer: Organizer | null;
  setToken: (token: string | null) => void;
  setOrganizer: (organizer: Organizer | null) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

const INITIAL_STATE: Omit<
  AuthState,
  'setToken' | 'setOrganizer' | 'clearAuth' | 'isAuthenticated'
> = {
  accessToken: null,
  organizer: null,
};

export const useAuthStore = createWithEqualityFn<AuthState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setToken: (token) => {
        set({ accessToken: token });
      },

      setOrganizer: (organizer) => {
        set({ organizer });
      },

      clearAuth: () => {
        set({
          accessToken: null,
          organizer: null,
        });
      },

      isAuthenticated: () => {
        const state = get();
        return state.accessToken !== null && state.organizer !== null;
      },
    }),
    {
      name: 'cherryplaylist-auth',
      version: 1,
      storage: electronStorage,
      partialize: (state) => ({
        accessToken: state.accessToken,
        organizer: state.organizer,
      }),
    },
  ),
);
