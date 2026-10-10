import {
  DEMO_SHARED_OUTPUT_CONFLICT_MESSAGE,
  isDemoSharedOutputConflictError,
  openDemoAudioDeviceSettings,
} from '../../../src/shared/demo/demoSharedOutputConflict';

const mockOpenSettingsModal = jest.fn();

jest.mock('../../../src/shared/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      openSettingsModal: mockOpenSettingsModal,
    }),
  },
}));

describe('demoSharedOutputConflict', () => {
  beforeEach(() => {
    mockOpenSettingsModal.mockClear();
  });

  it('recognizes current and legacy conflict error messages', () => {
    expect(isDemoSharedOutputConflictError(DEMO_SHARED_OUTPUT_CONFLICT_MESSAGE)).toBe(true);
    expect(
      isDemoSharedOutputConflictError(
        'Воспроизведение невозможно: используется то же устройство, что и плеер',
      ),
    ).toBe(true);
    expect(isDemoSharedOutputConflictError('engine failed')).toBe(false);
  });

  it('opens settings focused on demo audio device select', () => {
    openDemoAudioDeviceSettings();
    expect(mockOpenSettingsModal).toHaveBeenCalledWith('demo-player-audio-device');
  });
});
