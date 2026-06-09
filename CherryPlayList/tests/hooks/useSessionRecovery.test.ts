import { renderHook } from '@testing-library/react';

import {
  syncDemoWithMainPlayer,
  syncMainWithDemoPlayer,
} from '../../src/shared/stores/playbackDeviceConflictSync';
import { useSessionRecovery } from '../../src/workspaces/player/hooks/useSessionRecovery';
import { createTrack } from '../testUtils';

const mockLoadTrack = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/shared/stores/playbackDeviceConflictSync', () => ({
  syncDemoWithMainPlayer: jest.fn(),
  syncMainWithDemoPlayer: jest.fn(),
}));

jest.mock('../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      playerAudioDeviceId: 'main-device',
      demoPlayerAudioDeviceId: 'demo-device',
    }),
  },
}));

jest.mock('../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: {
    getState: () => ({
      currentTrack: null,
      loadTrack: mockLoadTrack,
    }),
  },
}));

const track = createTrack('track-1', '/track-1.mp3');

jest.mock('../../src/shared/stores', () => ({
  useProjectStore: {
    getState: () => ({
      sessionState: {
        mode: 'session',
        currentTrackId: 'track-1',
      },
      getAllTracksInOrder: () => [track],
    }),
    persist: {
      hasHydrated: () => true,
      onFinishHydration: jest.fn(),
    },
  },
}));

describe('useSessionRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs device conflict state when restoring session mode on hydration', () => {
    renderHook(() => useSessionRecovery());

    expect(syncMainWithDemoPlayer).toHaveBeenCalledWith('main-device');
    expect(syncDemoWithMainPlayer).toHaveBeenCalledWith('demo-device');
  });
});
