import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { DEFAULT_FILEBROWSER_WORKSPACE_ID } from '@core/constants/workspace';
import type { WorkspaceId } from '@core/types/workspace';

import type { AimpSourceSelection } from '../contracts/aimp';
import type { CustomKeyBindings, KeyBinding, ShortcutId } from '../shortcuts/shortcutTypes';
import { electronStorage } from '../storage/electronStorage';

interface FileBrowserPathPersistSlice {
  fileBrowserPath: string;
  fileBrowserPathsByWorkspaceId: Record<WorkspaceId, string>;
}

export interface DemoPlayerFloatingPosition {
  x: number;
  y: number;
}

export interface DemoPlayerFloatingSize {
  width: number;
  height: number;
}

interface SettingsState extends FileBrowserPathPersistSlice {
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  exportPath: string;
  exportStrategy: 'copyWithNumberPrefix' | 'aimpPlaylist';
  lastOpenedPlaylist: string;
  trackItemSizePreset: 'small' | 'medium' | 'large';
  hourDividerInterval: number;
  showHourDividers: boolean;
  playerAudioDeviceId: string | null;
  demoPlayerAudioDeviceId: string | null;
  demoPlayerFloatingPosition: DemoPlayerFloatingPosition | null;
  demoPlayerFloatingSize: DemoPlayerFloatingSize | null;
  demoPlayerFloatingOpen: boolean;
  playerInAppHeader: boolean;
  keyBindings: CustomKeyBindings;
  enableStreaming: boolean;
  streamingSource: AimpSourceSelection;
  getFileBrowserPathForWorkspace: (workspaceId: WorkspaceId) => string;
  setFileBrowserPathForWorkspace: (workspaceId: WorkspaceId, path: string) => void;
  removeFileBrowserPathForWorkspace: (workspaceId: WorkspaceId) => void;
  setExportPath: (path: string) => void;
  setExportStrategy: (strategy: 'copyWithNumberPrefix' | 'aimpPlaylist') => void;
  setLastOpenedPlaylist: (path: string) => void;
  /**
   * @deprecated Use {@link setFileBrowserPathForWorkspace} with
   * `DEFAULT_FILEBROWSER_WORKSPACE_ID`. Remove after subtask 04 when no callers remain.
   */
  setFileBrowserPath: (path: string) => void;
  setTrackItemSizePreset: (preset: 'small' | 'medium' | 'large') => void;
  setHourDividerInterval: (interval: number) => void;
  setShowHourDividers: (show: boolean) => void;
  setPlayerAudioDeviceId: (deviceId: string | null) => void;
  setDemoPlayerAudioDeviceId: (deviceId: string | null) => void;
  setDemoPlayerFloatingPosition: (position: DemoPlayerFloatingPosition | null) => void;
  setDemoPlayerFloatingSize: (size: DemoPlayerFloatingSize | null) => void;
  setDemoPlayerFloatingOpen: (open: boolean) => void;
  setPlayerInAppHeader: (enabled: boolean) => void;
  setKeyBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetKeyBindings: () => void;
  setEnableStreaming: (enable: boolean) => void;
  setStreamingSource: (source: AimpSourceSelection) => void;
}

export function migrateFileBrowserPathsOnRehydrate(
  state: Partial<FileBrowserPathPersistSlice>,
): FileBrowserPathPersistSlice {
  const legacyPath = state.fileBrowserPath ?? '';
  const map = { ...(state.fileBrowserPathsByWorkspaceId ?? {}) };
  const defaultId = DEFAULT_FILEBROWSER_WORKSPACE_ID;
  const mapEmpty = Object.keys(map).length === 0;
  const missingDefaultKey = !(defaultId in map);

  if (legacyPath && (mapEmpty || missingDefaultKey)) {
    map[defaultId] = legacyPath;
  }

  const defaultPath = defaultId in map ? map[defaultId] : legacyPath;

  return {
    fileBrowserPathsByWorkspaceId: map,
    fileBrowserPath: defaultPath ?? '',
  };
}

export const useSettingsStore = createWithEqualityFn<SettingsState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      exportPath: '',
      exportStrategy: 'copyWithNumberPrefix',
      lastOpenedPlaylist: '',
      fileBrowserPath: '',
      fileBrowserPathsByWorkspaceId: {},
      trackItemSizePreset: 'medium',
      hourDividerInterval: 3600,
      showHourDividers: true,
      playerAudioDeviceId: null,
      demoPlayerAudioDeviceId: null,
      demoPlayerFloatingPosition: null,
      demoPlayerFloatingSize: null,
      demoPlayerFloatingOpen: true,
      playerInAppHeader: false,
      keyBindings: {},
      enableStreaming: true,
      streamingSource: 'cherryPlayPlayer',

      getFileBrowserPathForWorkspace: (workspaceId) => {
        const state = get();
        if (workspaceId in state.fileBrowserPathsByWorkspaceId) {
          return state.fileBrowserPathsByWorkspaceId[workspaceId];
        }
        if (workspaceId === DEFAULT_FILEBROWSER_WORKSPACE_ID) {
          return state.fileBrowserPath;
        }
        return '';
      },

      setFileBrowserPathForWorkspace: (workspaceId, path) =>
        set((state) => {
          const fileBrowserPathsByWorkspaceId = {
            ...state.fileBrowserPathsByWorkspaceId,
            [workspaceId]: path,
          };
          if (workspaceId === DEFAULT_FILEBROWSER_WORKSPACE_ID) {
            return { fileBrowserPathsByWorkspaceId, fileBrowserPath: path };
          }
          return { fileBrowserPathsByWorkspaceId };
        }),

      removeFileBrowserPathForWorkspace: (workspaceId) =>
        set((state) => {
          const inMap = workspaceId in state.fileBrowserPathsByWorkspaceId;
          const isDefault = workspaceId === DEFAULT_FILEBROWSER_WORKSPACE_ID;
          const legacyOnly = isDefault && !inMap && state.fileBrowserPath !== '';

          if (!inMap && !legacyOnly) {
            return state;
          }

          if (legacyOnly) {
            return { fileBrowserPath: '' };
          }

          const { [workspaceId]: _removed, ...fileBrowserPathsByWorkspaceId } =
            state.fileBrowserPathsByWorkspaceId;
          if (isDefault) {
            return { fileBrowserPathsByWorkspaceId, fileBrowserPath: '' };
          }
          return { fileBrowserPathsByWorkspaceId };
        }),

      setExportPath: (path) => set({ exportPath: path }),
      setExportStrategy: (strategy) => set({ exportStrategy: strategy }),
      setLastOpenedPlaylist: (path) => set({ lastOpenedPlaylist: path }),

      /** @deprecated Use setFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID, path). */
      setFileBrowserPath: (path) => {
        get().setFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID, path);
      },

      setTrackItemSizePreset: (preset) => set({ trackItemSizePreset: preset }),
      setHourDividerInterval: (interval) => set({ hourDividerInterval: interval }),
      setShowHourDividers: (show) => set({ showHourDividers: show }),
      setPlayerAudioDeviceId: (deviceId) => set({ playerAudioDeviceId: deviceId }),
      setDemoPlayerAudioDeviceId: (deviceId) => set({ demoPlayerAudioDeviceId: deviceId }),
      setDemoPlayerFloatingPosition: (position) => set({ demoPlayerFloatingPosition: position }),
      setDemoPlayerFloatingSize: (size) => set({ demoPlayerFloatingSize: size }),
      setDemoPlayerFloatingOpen: (open) => set({ demoPlayerFloatingOpen: open }),
      setPlayerInAppHeader: (enabled) => set({ playerInAppHeader: enabled }),
      setKeyBinding: (id, binding) =>
        set((state) => ({
          keyBindings: { ...state.keyBindings, [id]: binding },
        })),
      resetKeyBindings: () => set({ keyBindings: {} }),
      setEnableStreaming: (enable) => set({ enableStreaming: enable }),
      setStreamingSource: (source) => set({ streamingSource: source }),
    }),
    {
      name: 'cherryplaylist-settings',
      storage: electronStorage,
      partialize: (state) => ({
        exportPath: state.exportPath,
        exportStrategy: state.exportStrategy,
        lastOpenedPlaylist: state.lastOpenedPlaylist,
        fileBrowserPath: state.fileBrowserPath,
        fileBrowserPathsByWorkspaceId: state.fileBrowserPathsByWorkspaceId,
        trackItemSizePreset: state.trackItemSizePreset,
        hourDividerInterval: state.hourDividerInterval,
        showHourDividers: state.showHourDividers,
        playerAudioDeviceId: state.playerAudioDeviceId,
        demoPlayerAudioDeviceId: state.demoPlayerAudioDeviceId,
        demoPlayerFloatingPosition: state.demoPlayerFloatingPosition,
        demoPlayerFloatingSize: state.demoPlayerFloatingSize,
        demoPlayerFloatingOpen: state.demoPlayerFloatingOpen,
        playerInAppHeader: state.playerInAppHeader,
        keyBindings: state.keyBindings,
        enableStreaming: state.enableStreaming,
        streamingSource: state.streamingSource,
      }),
      onRehydrateStorage: () => (state, _err) => {
        if (state) {
          const migrated = migrateFileBrowserPathsOnRehydrate(state);
          useSettingsStore.setState(migrated);
        }
        useSettingsStore.getState().setHasHydrated(true);
      },
    },
  ),
);
