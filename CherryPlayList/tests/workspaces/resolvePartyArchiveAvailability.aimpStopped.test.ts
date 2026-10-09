import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import { resolvePartyPlaybackSourceState } from '../../src/workspaces/party/partyPlaybackSource';
import { resolvePartyArchiveAvailability } from '../../src/workspaces/party/resolvePartyArchiveAvailability';

describe('resolvePartyArchiveAvailability AIMP stopped (Конец)', () => {
  it('allows archive when AIMP live stream has stopped', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      playbackSourceState: resolvePartyPlaybackSourceState('aimp', {
        sessionMode: 'preparation',
        playerPlaybackStatus: 'idle',
        aimpBridgeState: {
          ...createInitialAimpBridgeState(),
          liveStreamStarted: true,
          playbackSnapshot: {
            revision: 1,
            status: 'stopped',
            currentTrackKey: null,
            positionMs: 0,
            isMuted: false,
            receivedAt: '',
            sentAt: '',
          },
        },
      }),
    });
    expect(result.mode).toBe('active');
    expect(result.canArchive).toBe(true);
    expect(result.isBlockedByLive).toBe(false);
  });
});
