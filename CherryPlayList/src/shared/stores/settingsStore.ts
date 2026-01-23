import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import type { CustomKeyBindings, KeyBinding, ShortcutId } from '../shortcuts/shortcutTypes';
import { electronStorage } from '../storage/electronStorage';

interface SettingsState {
  exportPath: string;
  exportStrategy: 'copyWithNumberPrefix' | 'aimpPlaylist';
  lastOpenedPlaylist: string;
  trackItemSizePreset: 'small' | 'medium' | 'large';
  hourDividerInterval: number;
  showHourDividers: boolean;
  // Audio device settings
  playerAudioDeviceId: string | null;
  demoPlayerAudioDeviceId: string | null;
  // Keyboard shortcuts customization
  keyBindings: CustomKeyBindings;

  // Actions
  setExportPath: (path: string) => void;
  setExportStrategy: (strategy: 'copyWithNumberPrefix' | 'aimpPlaylist') => void;
  setLastOpenedPlaylist: (path: string) => void;
  setTrackItemSizePreset: (preset: 'small' | 'medium' | 'large') => void;
  setHourDividerInterval: (interval: number) => void;
  setShowHourDividers: (show: boolean) => void;
  setPlayerAudioDeviceId: (deviceId: string | null) => void;
  setDemoPlayerAudioDeviceId: (deviceId: string | null) => void;
  // Keyboard shortcuts actions
  setKeyBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetKeyBindings: () => void;
}

export const useSettingsStore = createWithEqualityFn<SettingsState>()(
  persist(
    (set) => ({
      exportPath: '',
      exportStrategy: 'copyWithNumberPrefix',
      lastOpenedPlaylist: '',
      trackItemSizePreset: 'medium',
      hourDividerInterval: 3600,
      showHourDividers: true,
      playerAudioDeviceId: null,
      demoPlayerAudioDeviceId: null,
      keyBindings: {},

      setExportPath: (path) => set({ exportPath: path }),
      setExportStrategy: (strategy) => set({ exportStrategy: strategy }),
      setLastOpenedPlaylist: (path) => set({ lastOpenedPlaylist: path }),
      setTrackItemSizePreset: (preset) => set({ trackItemSizePreset: preset }),
      setHourDividerInterval: (interval) => set({ hourDividerInterval: interval }),
      setShowHourDividers: (show) => set({ showHourDividers: show }),
      setPlayerAudioDeviceId: (deviceId) => set({ playerAudioDeviceId: deviceId }),
      setDemoPlayerAudioDeviceId: (deviceId) => set({ demoPlayerAudioDeviceId: deviceId }),
      setKeyBinding: (id, binding) =>
        set((state) => ({
          keyBindings: { ...state.keyBindings, [id]: binding },
        })),
      resetKeyBindings: () => set({ keyBindings: {} }),
    }),
    {
      name: 'cherryplaylist-settings',
      version: 4,
      storage: electronStorage,
      partialize: (state) => ({
        exportPath: state.exportPath,
        exportStrategy: state.exportStrategy,
        lastOpenedPlaylist: state.lastOpenedPlaylist,
        trackItemSizePreset: state.trackItemSizePreset,
        hourDividerInterval: state.hourDividerInterval,
        showHourDividers: state.showHourDividers,
        playerAudioDeviceId: state.playerAudioDeviceId,
        demoPlayerAudioDeviceId: state.demoPlayerAudioDeviceId,
        keyBindings: state.keyBindings,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<SettingsState>;
        if (version === 1) {
          return {
            ...state,
            trackItemSizePreset: 'medium',
            hourDividerInterval: 3600,
            showHourDividers: true,
            playerAudioDeviceId: null,
            demoPlayerAudioDeviceId: null,
            keyBindings: {},
          };
        }
        if (version === 2) {
          return {
            ...state,
            playerAudioDeviceId: null,
            demoPlayerAudioDeviceId: null,
            keyBindings: {},
          };
        }
        if (version === 3) {
          return {
            ...state,
            keyBindings: {},
          };
        }
        return persistedState;
      },
    },
  ),
);
