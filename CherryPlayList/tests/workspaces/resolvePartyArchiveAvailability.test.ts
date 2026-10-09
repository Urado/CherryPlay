import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import { resolvePartyPlaybackSourceState } from '../../src/workspaces/party/partyPlaybackSource';
import { resolvePartyArchiveAvailability } from '../../src/workspaces/party/resolvePartyArchiveAvailability';

const playbackSourceState = (
  streamingSource: 'cherryPlayPlayer' | 'aimp',
  sessionMode: 'preparation' | 'session',
  status?: 'playing' | 'paused' | 'stopped',
) => {
  const bridgeState = createInitialAimpBridgeState();
  return resolvePartyPlaybackSourceState(streamingSource, {
    sessionMode,
    playerPlaybackStatus: status === 'playing' || status === 'paused' ? status : 'idle',
    aimpBridgeState: {
      ...bridgeState,
      sourceSelection: streamingSource,
      liveStreamStarted: streamingSource === 'aimp' && status !== undefined,
      playbackSnapshot: status
        ? {
            revision: 1,
            status,
            currentTrackKey: null,
            positionMs: 0,
            isMuted: false,
            receivedAt: '',
            sentAt: '',
          }
        : null,
    },
  });
};

describe('resolvePartyArchiveAvailability', () => {
  it('hides danger section when not ready', () => {
    expect(
      resolvePartyArchiveAvailability({
        partyLifecycleState: 'completed',
        playbackSourceState: playbackSourceState('cherryPlayPlayer', 'preparation'),
      }).showDangerSection,
    ).toBe(false);
    expect(
      resolvePartyArchiveAvailability({
        partyLifecycleState: 'draft',
        playbackSourceState: playbackSourceState('cherryPlayPlayer', 'preparation'),
      }).mode,
    ).toBe('hidden');
  });

  it('blocks archive while CherryPlay session is playing', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      playbackSourceState: playbackSourceState('cherryPlayPlayer', 'session', 'playing'),
    });
    expect(result.mode).toBe('blockedByLive');
    expect(result.canArchive).toBe(false);
    expect(result.isBlockedByLive).toBe(true);
  });

  it('quiets archive while CherryPlay session is paused', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      playbackSourceState: playbackSourceState('cherryPlayPlayer', 'session', 'paused'),
    });
    expect(result.mode).toBe('quiet');
    expect(result.canArchive).toBe(true);
    expect(result.isQuiet).toBe(true);
  });

  it('blocks archive while AIMP live stream is playing', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      playbackSourceState: playbackSourceState('aimp', 'preparation', 'playing'),
    });
    expect(result.mode).toBe('blockedByLive');
  });

  it('quiets archive while AIMP live stream is paused', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      playbackSourceState: playbackSourceState('aimp', 'preparation', 'paused'),
    });
    expect(result.mode).toBe('quiet');
    expect(result.canArchive).toBe(true);
    expect(result.isQuiet).toBe(true);
  });

  it('allows archive after stop / idle ready', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      playbackSourceState: playbackSourceState('cherryPlayPlayer', 'preparation'),
    });
    expect(result.mode).toBe('active');
    expect(result.canArchive).toBe(true);
    expect(result.showDangerSection).toBe(true);
  });
});
