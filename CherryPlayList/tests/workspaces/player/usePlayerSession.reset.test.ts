import { act, renderHook } from '@testing-library/react';

import { useDemoPlayerStore } from '../../../src/shared/stores/demoPlayerStore';
import { usePlayerAudioStore } from '../../../src/shared/stores/playerAudioStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { usePlayerSession } from '../../../src/workspaces/player/hooks/usePlayerSession';

describe('usePlayerSession reset', () => {
  it('stops the current track and returns audio status to idle', () => {
    const stop = jest.fn(() => usePlayerAudioStore.setState({ status: 'idle', position: 0 }));
    const resetSession = jest.fn();
    const clearPauseTimer = jest.fn();
    usePlayerAudioStore.setState({ status: 'playing', stop, clearPauseTimer });
    useProjectStore.setState({ resetSession });

    const { result } = renderHook(() =>
      usePlayerSession({ allTracks: [], isTrackActive: () => true }),
    );

    act(() => result.current.handleResetSession());

    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(clearPauseTimer).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(usePlayerAudioStore.getState().status).toBe('idle');
    expect(useDemoPlayerStore.getState().isDisabled).toBe(false);
  });
});
