import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import type { AimpSourceSelection } from '../contracts/aimp';
import {
  clampLoudnessQuietGapRangeLu,
  DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  DEFAULT_LOUDNESS_TARGET_LUFS,
  LOUDNESS_LISTENING_ENVIRONMENT_QUIET_GAP_LU,
  type LoudnessListeningEnvironment,
  type LoudnessSettings,
} from '../contracts/loudness';
import type { CustomKeyBindings, KeyBinding, ShortcutId } from '../shortcuts/shortcutTypes';
import { electronStorage } from '../storage/electronStorage';

export type { LoudnessSettings };

interface SettingsState {
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  exportPath: string;
  exportStrategy: 'copyWithNumberPrefix' | 'aimpPlaylist';
  lastOpenedPlaylist: string;
  fileBrowserPath: string;
  trackItemSizePreset: 'small' | 'medium' | 'large';
  hourDividerInterval: number;
  showHourDividers: boolean;
  playerAudioDeviceId: string | null;
  demoPlayerAudioDeviceId: string | null;
  keyBindings: CustomKeyBindings;
  enableStreaming: boolean;
  streamingSource: AimpSourceSelection;
  loudnessNormalizationEnabled: boolean;
  loudnessTargetLufs: number;
  loudnessCompressionEnabled: boolean;
  loudnessQuietGapRangeLu: number;
  setExportPath: (path: string) => void;
  setExportStrategy: (strategy: 'copyWithNumberPrefix' | 'aimpPlaylist') => void;
  setLastOpenedPlaylist: (path: string) => void;
  setFileBrowserPath: (path: string) => void;
  setTrackItemSizePreset: (preset: 'small' | 'medium' | 'large') => void;
  setHourDividerInterval: (interval: number) => void;
  setShowHourDividers: (show: boolean) => void;
  setPlayerAudioDeviceId: (deviceId: string | null) => void;
  setDemoPlayerAudioDeviceId: (deviceId: string | null) => void;
  setKeyBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetKeyBindings: () => void;
  setEnableStreaming: (enable: boolean) => void;
  setStreamingSource: (source: AimpSourceSelection) => void;
  setLoudnessNormalizationEnabled: (enabled: boolean) => void;
  setLoudnessTargetLufs: (targetLufs: number) => void;
  setLoudnessCompressionEnabled: (enabled: boolean) => void;
  setLoudnessQuietGapRangeLu: (quietGapRangeLu: number) => void;
}

export const useSettingsStore = createWithEqualityFn<SettingsState>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      exportPath: '',
      exportStrategy: 'copyWithNumberPrefix',
      lastOpenedPlaylist: '',
      fileBrowserPath: '',
      trackItemSizePreset: 'medium',
      hourDividerInterval: 3600,
      showHourDividers: true,
      playerAudioDeviceId: null,
      demoPlayerAudioDeviceId: null,
      keyBindings: {},
      enableStreaming: true,
      streamingSource: 'cherryPlayPlayer',
      loudnessNormalizationEnabled: true,
      loudnessTargetLufs: DEFAULT_LOUDNESS_TARGET_LUFS,
      loudnessCompressionEnabled: false,
      loudnessQuietGapRangeLu: DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,

      setExportPath: (path) => set({ exportPath: path }),
      setExportStrategy: (strategy) => set({ exportStrategy: strategy }),
      setLastOpenedPlaylist: (path) => set({ lastOpenedPlaylist: path }),
      setFileBrowserPath: (path) => set({ fileBrowserPath: path }),
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
      setStreamingSource: (source) => set({ streamingSource: source }),
      setLoudnessNormalizationEnabled: (enabled) => set({ loudnessNormalizationEnabled: enabled }),
      setLoudnessTargetLufs: (targetLufs) => set({ loudnessTargetLufs: targetLufs }),
      setLoudnessCompressionEnabled: (enabled) => set({ loudnessCompressionEnabled: enabled }),
      setLoudnessQuietGapRangeLu: (quietGapRangeLu) =>
        set({ loudnessQuietGapRangeLu: clampLoudnessQuietGapRangeLu(quietGapRangeLu) }),
    }),
    {
      name: 'cherryplaylist-settings',
      storage: electronStorage,
      version: 1,
      migrate: (persistedState) => {
        const state = { ...(persistedState as object) } as Record<string, unknown>;
        if (typeof state.loudnessQuietGapRangeLu !== 'number') {
          const environment = state.loudnessListeningEnvironment;
          if (
            typeof environment === 'string' &&
            environment in LOUDNESS_LISTENING_ENVIRONMENT_QUIET_GAP_LU
          ) {
            state.loudnessQuietGapRangeLu =
              LOUDNESS_LISTENING_ENVIRONMENT_QUIET_GAP_LU[
                environment as LoudnessListeningEnvironment
              ];
          } else {
            state.loudnessQuietGapRangeLu = DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU;
          }
          delete state.loudnessListeningEnvironment;
        }
        return state as unknown as SettingsState;
      },
      partialize: (state) => ({
        exportPath: state.exportPath,
        exportStrategy: state.exportStrategy,
        lastOpenedPlaylist: state.lastOpenedPlaylist,
        fileBrowserPath: state.fileBrowserPath,
        trackItemSizePreset: state.trackItemSizePreset,
        hourDividerInterval: state.hourDividerInterval,
        showHourDividers: state.showHourDividers,
        playerAudioDeviceId: state.playerAudioDeviceId,
        demoPlayerAudioDeviceId: state.demoPlayerAudioDeviceId,
        keyBindings: state.keyBindings,
        enableStreaming: state.enableStreaming,
        streamingSource: state.streamingSource,
        loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
        loudnessTargetLufs: state.loudnessTargetLufs,
        loudnessCompressionEnabled: state.loudnessCompressionEnabled,
        loudnessQuietGapRangeLu: state.loudnessQuietGapRangeLu,
      }),
      onRehydrateStorage: () => (_state, _err) => {
        useSettingsStore.getState().setHasHydrated(true);
      },
    },
  ),
);
