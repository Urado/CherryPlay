jest.mock('../../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: { getState: jest.fn() },
}));

jest.mock('../../../src/shared/stores/demoPlayerStore', () => ({
  useDemoPlayerStore: { getState: jest.fn() },
}));

jest.mock('../../../src/shared/stores/projectStore', () => ({
  useProjectStore: { getState: jest.fn() },
}));

jest.mock('../../../src/shared/demo/demoLiveMockPlayback', () => ({
  stopDemoLiveMockPlayback: jest.fn(),
}));

import { stopDemoLiveMockPlayback } from '../../../src/shared/demo/demoLiveMockPlayback';
import { useDemoPlayerStore } from '../../../src/shared/stores/demoPlayerStore';
import { usePlayerAudioStore } from '../../../src/shared/stores/playerAudioStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { stopLocalPlayerSession } from '../../../src/shared/utils/newProjectSessionGuard';

describe('stopLocalPlayerSession', () => {
  it('stops local playback while preserving the active project session and linked party', () => {
    const projectState = {
      sessionState: { mode: 'session' },
      meta: { linkedParty: { id: 'party-1' } },
      resetSession: jest.fn(),
    };
    const clearPauseTimer = jest.fn();
    const pause = jest.fn();
    const setDisabled = jest.fn();
    jest.mocked(useProjectStore.getState).mockReturnValue(projectState as never);
    jest.mocked(usePlayerAudioStore.getState).mockReturnValue({
      clearPauseTimer,
      pause,
    } as never);
    jest.mocked(useDemoPlayerStore.getState).mockReturnValue({ setDisabled } as never);

    stopLocalPlayerSession();

    expect(clearPauseTimer).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(stopDemoLiveMockPlayback).toHaveBeenCalledTimes(1);
    expect(setDisabled).toHaveBeenCalledWith(false);
    expect(projectState.resetSession).not.toHaveBeenCalled();
    expect(projectState.sessionState.mode).toBe('session');
    expect(projectState.meta.linkedParty).toEqual({ id: 'party-1' });
  });
});
