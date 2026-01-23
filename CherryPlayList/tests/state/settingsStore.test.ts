import { act } from '@testing-library/react';

import { useSettingsStore } from '../../src/state/settingsStore';

const resetStore = () => {
  useSettingsStore.setState({
    exportPath: '',
    exportStrategy: 'copyWithNumberPrefix',
    lastOpenedPlaylist: '',
    trackItemSizePreset: 'medium',
    hourDividerInterval: 3600,
    showHourDividers: true,
  });
};

beforeEach(() => {
  resetStore();
});

describe('settingsStore', () => {
  describe('trackItemSizePreset', () => {
    it('should have default value "medium"', () => {
      const state = useSettingsStore.getState();
      expect(state.trackItemSizePreset).toBe('medium');
    });

    it('should update trackItemSizePreset', () => {
      const store = useSettingsStore.getState();
      act(() => {
        store.setTrackItemSizePreset('small');
      });
      expect(useSettingsStore.getState().trackItemSizePreset).toBe('small');

      act(() => {
        store.setTrackItemSizePreset('large');
      });
      expect(useSettingsStore.getState().trackItemSizePreset).toBe('large');
    });

    it('should accept all preset values', () => {
      const store = useSettingsStore.getState();
      const presets: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

      presets.forEach((preset) => {
        act(() => {
          store.setTrackItemSizePreset(preset);
        });
        expect(useSettingsStore.getState().trackItemSizePreset).toBe(preset);
      });
    });
  });

  describe('hourDividerInterval', () => {
    it('should have default value 3600 (1 hour)', () => {
      const state = useSettingsStore.getState();
      expect(state.hourDividerInterval).toBe(3600);
    });

    it('should update hourDividerInterval', () => {
      const store = useSettingsStore.getState();
      act(() => {
        store.setHourDividerInterval(1800);
      });
      expect(useSettingsStore.getState().hourDividerInterval).toBe(1800);

      act(() => {
        store.setHourDividerInterval(7200);
      });
      expect(useSettingsStore.getState().hourDividerInterval).toBe(7200);
    });

    it('should accept various interval values', () => {
      const store = useSettingsStore.getState();
      const intervals = [900, 1800, 3600, 7200, 10800];

      intervals.forEach((interval) => {
        act(() => {
          store.setHourDividerInterval(interval);
        });
        expect(useSettingsStore.getState().hourDividerInterval).toBe(interval);
      });
    });
  });

  describe('showHourDividers', () => {
    it('should have default value true', () => {
      const state = useSettingsStore.getState();
      expect(state.showHourDividers).toBe(true);
    });

    it('should update showHourDividers', () => {
      const store = useSettingsStore.getState();
      act(() => {
        store.setShowHourDividers(false);
      });
      expect(useSettingsStore.getState().showHourDividers).toBe(false);

      act(() => {
        store.setShowHourDividers(true);
      });
      expect(useSettingsStore.getState().showHourDividers).toBe(true);
    });
  });

  describe('existing settings', () => {
    it('should preserve existing settings when updating new ones', () => {
      const store = useSettingsStore.getState();
      act(() => {
        store.setExportPath('/test/path');
        store.setExportStrategy('aimpPlaylist');
        store.setTrackItemSizePreset('large');
        store.setHourDividerInterval(1800);
        store.setShowHourDividers(false);
      });

      const state = useSettingsStore.getState();
      expect(state.exportPath).toBe('/test/path');
      expect(state.exportStrategy).toBe('aimpPlaylist');
      expect(state.trackItemSizePreset).toBe('large');
      expect(state.hourDividerInterval).toBe(1800);
      expect(state.showHourDividers).toBe(false);
    });
  });
});
