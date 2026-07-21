import { syncDemoWithMainPlayer } from '../../../src/shared/stores/playbackDeviceConflictSync';

const mockDemoPause = jest.fn();
const mockDemoSetDisabled = jest.fn();

let sessionMode: 'preparation' | 'session' = 'preparation';
let playerDeviceId: string | null = null;
let demoStatus: 'idle' | 'playing' | 'paused' = 'idle';
let playerStatus: 'idle' | 'playing' | 'paused' = 'idle';

jest.mock('../../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      playerAudioDeviceId: playerDeviceId,
      demoPlayerAudioDeviceId: null,
    }),
  },
}));

jest.mock('../../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: {
    getState: () => ({
      status: playerStatus,
      pause: jest.fn(),
    }),
  },
}));

jest.mock('../../../src/shared/stores/demoPlayerStore', () => ({
  useDemoPlayerStore: {
    getState: () => ({
      status: demoStatus,
      pause: mockDemoPause,
      setDisabled: mockDemoSetDisabled,
    }),
  },
}));

jest.mock('../../../src/shared/stores/projectStoreFactory', () => ({
  getProjectStore: () => ({
    getState: () => ({
      sessionState: { mode: sessionMode },
    }),
  }),
}));

describe('playbackDeviceConflictSync demo status regression', () => {
  beforeEach(() => {
    sessionMode = 'session';
    playerDeviceId = 'shared-device';
    demoStatus = 'playing';
    playerStatus = 'idle';
    mockDemoPause.mockClear();
    mockDemoSetDisabled.mockClear();
  });

  it('pauses demo on shared output conflict based on demo status', () => {
    syncDemoWithMainPlayer('shared-device');

    expect(mockDemoPause).toHaveBeenCalledTimes(1);
    expect(mockDemoSetDisabled).toHaveBeenCalledWith(true);
  });
});
