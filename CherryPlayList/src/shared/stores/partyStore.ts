/**
 * Store для состояния вечеринки
 * Сохраняет данные о созданной вечеринке и статусе трансляции
 */
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { electronStorage } from '../storage/electronStorage';

interface PartyState {
  createdParty: { id: string; shortCode: string; url: string } | null;
  isStreaming: boolean;
  setCreatedParty: (party: { id: string; shortCode: string; url: string } | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  clearParty: () => void;
}

const INITIAL_STATE: Omit<PartyState, 'setCreatedParty' | 'setIsStreaming' | 'clearParty'> = {
  createdParty: null,
  isStreaming: false,
};

export const usePartyStore = createWithEqualityFn<PartyState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setCreatedParty: (party) => {
        set({ createdParty: party });
      },

      setIsStreaming: (isStreaming) => {
        set({ isStreaming });
      },

      clearParty: () => {
        set({
          createdParty: null,
          isStreaming: false,
        });
      },
    }),
    {
      name: 'cherryplaylist-party',
      version: 1,
      storage: electronStorage, // Используем localforage вместо localStorage
      partialize: (state) => ({
        createdParty: state.createdParty,
        isStreaming: state.isStreaming,
      }),
    },
  ),
);
