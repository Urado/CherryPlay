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

import type { UserWorkspace } from '../../src/core/types/workspacePreset';
import {
  applySettingsImport,
  buildSettingsExportBundle,
  mergeUserWorkspacesOnImport,
  parseSettingsBundleJson,
  pickSettingsExportFields,
  SETTINGS_EXPORT_SCHEMA_VERSION,
  validateSettingsExportBundle,
} from '../../src/shared/services/settingsExportService';
import {
  useLayoutStore,
  createDefaultWorkspacePersistSlice,
} from '../../src/shared/stores/layoutStore';
import { useSettingsStore } from '../../src/shared/stores/settingsStore';

const resetStores = () => {
  useSettingsStore.setState({
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
  });

  const defaults = createDefaultWorkspacePersistSlice();
  useLayoutStore.setState({
    ...defaults,
    baselineLayout: JSON.parse(JSON.stringify(defaults.layout)),
    isLayoutEditMode: false,
    openLayoutEditPickerKey: null,
  });
};

function createUserWorkspace(id: string, name: string): UserWorkspace {
  const layout = JSON.parse(JSON.stringify(useLayoutStore.getState().layout));
  return {
    id,
    name,
    layout,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  resetStores();
});

describe('settingsExportService', () => {
  describe('buildSettingsExportBundle', () => {
    it('produces schema v1 bundle with settings and user workspaces', () => {
      act(() => {
        useSettingsStore.getState().setTrackItemSizePreset('large');
        useSettingsStore.getState().setExportPath('/music/export');
        useLayoutStore.getState().saveCurrentWorkspaceAs('Exported workspace');
      });

      const bundle = buildSettingsExportBundle();

      expect(bundle.schemaVersion).toBe(SETTINGS_EXPORT_SCHEMA_VERSION);
      expect(bundle.settings.trackItemSizePreset).toBe('large');
      expect(bundle.settings.exportPath).toBe('/music/export');
      expect(bundle.workspaces.userWorkspaces).toHaveLength(1);
      expect(bundle.workspaces.userWorkspaces[0]?.name).toBe('Exported workspace');
      expect(bundle.workspaces.activeWorkspace).toEqual({
        kind: 'user',
        id: bundle.workspaces.userWorkspaces[0]?.id,
      });
      expect(bundle).not.toHaveProperty('accessToken');
      expect(bundle.settings).not.toHaveProperty('accessToken');
    });

    it('excludes scratch active workspace from export', () => {
      act(() => {
        useLayoutStore.getState().createScratchWorkspace();
      });

      const bundle = buildSettingsExportBundle();
      expect(bundle.workspaces.activeWorkspace).toBeUndefined();
    });
  });

  describe('validateSettingsExportBundle', () => {
    it('rejects bundles with auth fields', () => {
      const bundle = buildSettingsExportBundle();
      const withAuth = {
        ...bundle,
        settings: {
          ...bundle.settings,
          accessToken: 'secret-token',
        },
      };

      expect(validateSettingsExportBundle(withAuth)).toBe(false);
    });

    it('rejects unsupported schema versions', () => {
      const bundle = buildSettingsExportBundle();
      expect(
        validateSettingsExportBundle({
          ...bundle,
          schemaVersion: 2,
        }),
      ).toBe(false);
    });
  });

  describe('parseSettingsBundleJson', () => {
    it('parses valid JSON and rejects malformed input', () => {
      const bundle = buildSettingsExportBundle();
      const parsed = parseSettingsBundleJson(JSON.stringify(bundle));
      expect(parsed.schemaVersion).toBe(1);

      expect(() => parseSettingsBundleJson('{ invalid json')).toThrow('Некорректный JSON');
      expect(() => parseSettingsBundleJson(JSON.stringify({ schemaVersion: 99 }))).toThrow(
        'Неподдерживаемый формат файла настроек',
      );
    });
  });

  describe('mergeUserWorkspacesOnImport', () => {
    it('merges by id with incoming winning and appends new ids', () => {
      const existing = [createUserWorkspace('ws-1', 'Alpha'), createUserWorkspace('ws-2', 'Beta')];
      const incoming = [
        { ...createUserWorkspace('ws-1', 'Alpha updated'), name: 'Alpha updated' },
        createUserWorkspace('ws-3', 'Gamma'),
      ];

      const result = mergeUserWorkspacesOnImport(existing, incoming);

      expect(result.importedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(result.merged).toHaveLength(3);
      expect(result.merged.find((workspace) => workspace.id === 'ws-1')?.name).toBe(
        'Alpha updated',
      );
      expect(result.merged.find((workspace) => workspace.id === 'ws-3')?.name).toBe('Gamma');
    });

    it('suffixes conflicting names for new workspaces', () => {
      const existing = [createUserWorkspace('ws-1', 'My layout')];
      const incoming = [createUserWorkspace('ws-2', 'My layout')];

      const result = mergeUserWorkspacesOnImport(existing, incoming);
      expect(result.merged.find((workspace) => workspace.id === 'ws-2')?.name).toBe(
        'My layout (2)',
      );
    });
  });

  describe('applySettingsImport', () => {
    it('merges settings and workspaces into stores', () => {
      const bundle = buildSettingsExportBundle();
      bundle.settings.trackItemSizePreset = 'small';
      bundle.settings.enableStreaming = false;
      bundle.workspaces.userWorkspaces = [createUserWorkspace('imported-1', 'Imported workspace')];
      bundle.workspaces.activeWorkspace = { kind: 'user', id: 'imported-1' };

      const result = applySettingsImport(bundle);

      expect(result.settingsFieldCount).toBe(
        Object.keys(pickSettingsExportFields(useSettingsStore.getState())).length,
      );
      expect(useSettingsStore.getState().trackItemSizePreset).toBe('small');
      expect(useSettingsStore.getState().enableStreaming).toBe(false);
      expect(useLayoutStore.getState().userWorkspaces).toHaveLength(1);
      expect(useLayoutStore.getState().activeWorkspace).toEqual({
        kind: 'user',
        id: 'imported-1',
      });
    });
  });
});
