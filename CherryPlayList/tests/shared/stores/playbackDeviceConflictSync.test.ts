import {
  shouldBlockSharedOutput,
  syncDemoWithMainPlayer,
  syncMainWithDemoPlayer,
} from '../../../src/shared/stores/playbackDeviceConflictSync';

const mockDemoPause = jest.fn();
const mockDemoSetDisabled = jest.fn();
const mockPlayerPause = jest.fn();

let sessionMode: 'preparation' | 'session' = 'preparation';
let playerDeviceId: string | null = null;
let demoDeviceId: string | null = null;
let playerStatus: 'idle' | 'playing' | 'paused' = 'idle';
let demoStatus: 'idle' | 'playing' | 'paused' = 'idle';

jest.mock('../../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      playerAudioDeviceId: playerDeviceId,
      demoPlayerAudioDeviceId: demoDeviceId,
    }),
  },
}));

jest.mock('../../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: {
    getState: () => ({
      status: playerStatus,
      pause: mockPlayerPause,
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

describe('playbackDeviceConflictSync', () => {
  beforeEach(() => {
    sessionMode = 'preparation';
    playerDeviceId = null;
    demoDeviceId = null;
    playerStatus = 'idle';
    demoStatus = 'idle';
    mockDemoPause.mockClear();
    mockDemoSetDisabled.mockClear();
    mockPlayerPause.mockClear();
  });

  describe('shouldBlockSharedOutput', () => {
    it('returns false in preparation mode even when devices match', () => {
      expect(shouldBlockSharedOutput('device-a', 'device-a', 'preparation')).toBe(false);
    });

    it('returns false in session mode when devices differ', () => {
      expect(shouldBlockSharedOutput('device-a', 'device-b', 'session')).toBe(false);
    });

    it('returns true in session mode when devices match', () => {
      expect(shouldBlockSharedOutput('device-a', 'device-a', 'session')).toBe(true);
    });

    it('treats null device ids as matching', () => {
      expect(shouldBlockSharedOutput(null, null, 'session')).toBe(true);
    });
  });

  describe('syncDemoWithMainPlayer', () => {
    it('disables demo and pauses it when main player is playing on shared device in session', () => {
      sessionMode = 'session';
      playerDeviceId = 'shared';
      demoDeviceId = 'shared';
      playerStatus = 'playing';

      syncDemoWithMainPlayer('shared');

      expect(mockDemoPause).toHaveBeenCalledTimes(1);
      expect(mockDemoSetDisabled).toHaveBeenCalledWith(true);
    });

    it('re-enables demo when devices no longer conflict', () => {
      sessionMode = 'session';
      playerDeviceId = 'main-only';
      demoDeviceId = 'demo-only';

      syncDemoWithMainPlayer('demo-only');

      expect(mockDemoPause).not.toHaveBeenCalled();
      expect(mockDemoSetDisabled).toHaveBeenCalledWith(false);
    });

    it('does not disable demo in preparation mode when devices match', () => {
      sessionMode = 'preparation';
      playerDeviceId = 'shared';
      demoDeviceId = 'shared';
      playerStatus = 'playing';

      syncDemoWithMainPlayer('shared');

      expect(mockDemoPause).not.toHaveBeenCalled();
      expect(mockDemoSetDisabled).toHaveBeenCalledWith(false);
    });

    it('blocks demo play on shared device in session while main is already playing', () => {
      sessionMode = 'session';
      playerDeviceId = 'shared-output';
      demoDeviceId = 'shared-output';
      playerStatus = 'playing';
      demoStatus = 'paused';

      syncDemoWithMainPlayer('shared-output');

      expect(mockDemoPause).toHaveBeenCalledTimes(1);
      expect(mockDemoSetDisabled).toHaveBeenCalledWith(true);
    });
  });

  describe('syncMainWithDemoPlayer', () => {
    it('pauses demo and disables it when demo is playing on shared device in session', () => {
      sessionMode = 'session';
      playerDeviceId = 'shared';
      demoDeviceId = 'shared';
      demoStatus = 'playing';

      syncMainWithDemoPlayer('shared');

      expect(mockDemoPause).toHaveBeenCalledTimes(1);
      expect(mockDemoSetDisabled).toHaveBeenCalledWith(true);
    });

    it('re-enables demo when conflict clears', () => {
      sessionMode = 'preparation';
      playerDeviceId = 'shared';
      demoDeviceId = 'shared';

      syncMainWithDemoPlayer('shared');

      expect(mockDemoPause).not.toHaveBeenCalled();
      expect(mockDemoSetDisabled).toHaveBeenCalledWith(false);
    });
  });
});
