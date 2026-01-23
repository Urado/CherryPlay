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
  playerAudioDeviceId: string | null;
  demoPlayerAudioDeviceId: string | null;
  keyBindings: CustomKeyBindings;
  enableStreaming: boolean;
  setExportPath: (path: string) => void;
  setExportStrategy: (strategy: 'copyWithNumberPrefix' | 'aimpPlaylist') => void;
  setLastOpenedPlaylist: (path: string) => void;
  setTrackItemSizePreset: (preset: 'small' | 'medium' | 'large') => void;
  setHourDividerInterval: (interval: number) => void;
  setShowHourDividers: (show: boolean) => void;
  setPlayerAudioDeviceId: (deviceId: string | null) => void;
  setDemoPlayerAudioDeviceId: (deviceId: string | null) => void;
  setKeyBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetKeyBindings: () => void;
  setEnableStreaming: (enable: boolean) => void;
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
      enableStreaming: false,

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
      setEnableStreaming: (enable) => set({ enableStreaming: enable }),
    }),
    {
      name: 'cherryplaylist-settings',
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
        enableStreaming: state.enableStreaming,
      }),
    },
  ),
);
