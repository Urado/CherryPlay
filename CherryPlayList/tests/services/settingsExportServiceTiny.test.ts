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
  applySettingsImport,
  buildSettingsExportBundle,
  parseSettingsBundleJson,
  validateSettingsExportBundle,
} from '../../src/shared/services/settingsExportService';
import { useSettingsStore } from '../../src/shared/stores/settingsStore';

describe('settingsExportService (tiny preset)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ trackItemSizePreset: 'medium' });
  });

  it('exports tiny preset in bundle', () => {
    act(() => {
      useSettingsStore.getState().setTrackItemSizePreset('tiny');
    });

    const bundle = buildSettingsExportBundle();
    expect(bundle.settings.trackItemSizePreset).toBe('tiny');
  });

  it('validates and imports bundle with tiny preset', () => {
    act(() => {
      useSettingsStore.getState().setTrackItemSizePreset('tiny');
    });

    const bundle = buildSettingsExportBundle();
    const json = JSON.stringify(bundle);

    expect(validateSettingsExportBundle(JSON.parse(json))).toBe(true);

    act(() => {
      useSettingsStore.getState().setTrackItemSizePreset('large');
    });

    const parsed = parseSettingsBundleJson(json);
    act(() => {
      applySettingsImport(parsed);
    });

    expect(useSettingsStore.getState().trackItemSizePreset).toBe('tiny');
  });
});
