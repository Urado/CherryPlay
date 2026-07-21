jest.mock('../../src/shared/services/ipcService', () => ({
  ipcService: {
    showSaveDialog: jest.fn(),
    showOpenFileDialog: jest.fn(),
    invoke: jest.fn(),
  },
}));

jest.mock('../../src/shared/platform/platformCapabilities', () => ({
  getPlatformCapabilities: () => ({ supportsNativeFileSystem: false }),
}));

import { act } from '@testing-library/react';

import {
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  generateWorkspaceId,
} from '../../src/core/constants/workspace';
import {
  applySettingsImport,
  buildSettingsExportBundle,
  pickSettingsExportFields,
  SETTINGS_EXPORT_SCHEMA_VERSION,
} from '../../src/shared/services/settingsExportService';
import {
  migrateFileBrowserPathsOnRehydrate,
  useSettingsStore,
} from '../../src/shared/stores/settingsStore';

const resetStore = () => {
  useSettingsStore.setState({
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
    keyBindings: {},
    enableStreaming: true,
    streamingSource: 'cherryPlayPlayer',
  });
};

beforeEach(() => {
  resetStore();
});

describe('fileBrowserPathMigration', () => {
  describe('migrateFileBrowserPathsOnRehydrate', () => {
    it('copies legacy fileBrowserPath into default workspace map entry', () => {
      const migrated = migrateFileBrowserPathsOnRehydrate({
        fileBrowserPath: '/music/legacy',
        fileBrowserPathsByWorkspaceId: {},
      });

      expect(migrated.fileBrowserPathsByWorkspaceId[DEFAULT_FILEBROWSER_WORKSPACE_ID]).toBe(
        '/music/legacy',
      );
      expect(migrated.fileBrowserPath).toBe('/music/legacy');
    });

    it('does not overwrite an existing default map entry from legacy', () => {
      const migrated = migrateFileBrowserPathsOnRehydrate({
        fileBrowserPath: '/music/legacy',
        fileBrowserPathsByWorkspaceId: {
          [DEFAULT_FILEBROWSER_WORKSPACE_ID]: '/music/map',
        },
      });

      expect(migrated.fileBrowserPathsByWorkspaceId[DEFAULT_FILEBROWSER_WORKSPACE_ID]).toBe(
        '/music/map',
      );
      expect(migrated.fileBrowserPath).toBe('/music/map');
    });

    it('syncs legacy field from default map entry when legacy is empty', () => {
      const migrated = migrateFileBrowserPathsOnRehydrate({
        fileBrowserPath: '',
        fileBrowserPathsByWorkspaceId: {
          [DEFAULT_FILEBROWSER_WORKSPACE_ID]: '/music/map-only',
        },
      });

      expect(migrated.fileBrowserPath).toBe('/music/map-only');
    });
  });

  describe('getFileBrowserPathForWorkspace', () => {
    it('returns empty string for fresh default workspace', () => {
      expect(
        useSettingsStore
          .getState()
          .getFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID),
      ).toBe('');
    });

    it('prefers map value over legacy for default workspace', () => {
      useSettingsStore.setState({
        fileBrowserPath: '/legacy/path',
        fileBrowserPathsByWorkspaceId: {
          [DEFAULT_FILEBROWSER_WORKSPACE_ID]: '/map/path',
        },
      });

      expect(
        useSettingsStore
          .getState()
          .getFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID),
      ).toBe('/map/path');
    });

    it('falls back to legacy when default map key is missing', () => {
      useSettingsStore.setState({
        fileBrowserPath: '/legacy/fallback',
        fileBrowserPathsByWorkspaceId: {},
      });

      expect(
        useSettingsStore
          .getState()
          .getFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID),
      ).toBe('/legacy/fallback');
    });
  });

  describe('setFileBrowserPathForWorkspace', () => {
    it('stores independent paths per workspace id', () => {
      const workspaceA = generateWorkspaceId();
      const workspaceB = generateWorkspaceId();
      const store = useSettingsStore.getState();

      act(() => {
        store.setFileBrowserPathForWorkspace(workspaceA, '/path/a');
        store.setFileBrowserPathForWorkspace(workspaceB, '/path/b');
      });

      expect(store.getFileBrowserPathForWorkspace(workspaceA)).toBe('/path/a');
      expect(store.getFileBrowserPathForWorkspace(workspaceB)).toBe('/path/b');
    });

    it('syncs legacy field when updating default workspace', () => {
      const store = useSettingsStore.getState();

      act(() => {
        store.setFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID, '/default/path');
      });

      const state = useSettingsStore.getState();
      expect(state.fileBrowserPath).toBe('/default/path');
      expect(state.fileBrowserPathsByWorkspaceId[DEFAULT_FILEBROWSER_WORKSPACE_ID]).toBe(
        '/default/path',
      );
      expect(store.getFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID)).toBe(
        '/default/path',
      );
    });
  });

  describe('setFileBrowserPath shim', () => {
    it('updates map and legacy field for default workspace', () => {
      const store = useSettingsStore.getState();

      act(() => {
        store.setFileBrowserPath('/shim/path');
      });

      const state = useSettingsStore.getState();
      expect(state.fileBrowserPath).toBe('/shim/path');
      expect(state.fileBrowserPathsByWorkspaceId[DEFAULT_FILEBROWSER_WORKSPACE_ID]).toBe(
        '/shim/path',
      );
    });
  });

  describe('settings export/import', () => {
    it('exports fileBrowserPathsByWorkspaceId map', () => {
      const workspaceId = generateWorkspaceId();

      act(() => {
        useSettingsStore.getState().setFileBrowserPathForWorkspace(workspaceId, '/export/path');
        useSettingsStore
          .getState()
          .setFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID, '/default/export');
      });

      const fields = pickSettingsExportFields(useSettingsStore.getState());

      expect(fields.fileBrowserPathsByWorkspaceId?.[workspaceId]).toBe('/export/path');
      expect(fields.fileBrowserPathsByWorkspaceId?.[DEFAULT_FILEBROWSER_WORKSPACE_ID]).toBe(
        '/default/export',
      );
      expect(fields.fileBrowserPath).toBe('/default/export');
    });

    it('imports v1 bundle with legacy fileBrowserPath into default map entry', () => {
      const bundle = {
        schemaVersion: SETTINGS_EXPORT_SCHEMA_VERSION,
        appVersion: 'test',
        exportedAt: '2026-01-01T00:00:00.000Z',
        settings: {
          exportPath: '',
          exportStrategy: 'copyWithNumberPrefix' as const,
          lastOpenedPlaylist: '',
          fileBrowserPath: '/imported/legacy',
          trackItemSizePreset: 'medium' as const,
          hourDividerInterval: 3600,
          showHourDividers: true,
          playerAudioDeviceId: null,
          demoPlayerAudioDeviceId: null,
          keyBindings: {},
          enableStreaming: true,
          streamingSource: 'cherryPlayPlayer' as const,
        },
        workspaces: {
          userWorkspaces: [],
        },
      };

      act(() => {
        applySettingsImport(bundle);
      });

      const state = useSettingsStore.getState();
      expect(state.fileBrowserPath).toBe('/imported/legacy');
      expect(state.fileBrowserPathsByWorkspaceId[DEFAULT_FILEBROWSER_WORKSPACE_ID]).toBe(
        '/imported/legacy',
      );
      expect(state.getFileBrowserPathForWorkspace(DEFAULT_FILEBROWSER_WORKSPACE_ID)).toBe(
        '/imported/legacy',
      );
    });

    it('round-trips map through export bundle', () => {
      const workspaceId = generateWorkspaceId();

      act(() => {
        useSettingsStore.getState().setFileBrowserPathForWorkspace(workspaceId, '/round/trip');
      });

      const bundle = buildSettingsExportBundle();
      resetStore();

      act(() => {
        applySettingsImport(bundle);
      });

      expect(useSettingsStore.getState().getFileBrowserPathForWorkspace(workspaceId)).toBe(
        '/round/trip',
      );
    });
  });
});
