import { resolvePartyArchiveAvailability } from '../../src/workspaces/party/resolvePartyArchiveAvailability';

describe('resolvePartyArchiveAvailability', () => {
  it('hides danger section when not ready', () => {
    expect(
      resolvePartyArchiveAvailability({
        partyLifecycleState: 'completed',
        sessionMode: 'preparation',
      }).showDangerSection,
    ).toBe(false);
    expect(
      resolvePartyArchiveAvailability({
        partyLifecycleState: 'draft',
        sessionMode: 'preparation',
      }).mode,
    ).toBe('hidden');
  });

  it('blocks archive while CherryPlay session is playing', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      sessionMode: 'session',
      playbackStatus: 'playing',
      streamingSource: 'cherryplay',
    });
    expect(result.mode).toBe('blockedByLive');
    expect(result.canArchive).toBe(false);
    expect(result.isBlockedByLive).toBe(true);
  });

  it('quiets archive while CherryPlay session is paused', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      sessionMode: 'session',
      playbackStatus: 'paused',
      streamingSource: 'cherryplay',
    });
    expect(result.mode).toBe('quiet');
    expect(result.canArchive).toBe(true);
    expect(result.isQuiet).toBe(true);
  });

  it('blocks archive while AIMP live stream is playing', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      sessionMode: 'preparation',
      streamingSource: 'aimp',
      aimpLiveStreamStarted: true,
      aimpPlaybackStatus: 'playing',
    });
    expect(result.mode).toBe('blockedByLive');
  });

  it('quiets archive while AIMP live stream is paused', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      sessionMode: 'preparation',
      streamingSource: 'aimp',
      aimpLiveStreamStarted: true,
      aimpPlaybackStatus: 'paused',
    });
    expect(result.mode).toBe('quiet');
    expect(result.canArchive).toBe(true);
    expect(result.isQuiet).toBe(true);
  });

  it('allows archive after stop / idle ready', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      sessionMode: 'preparation',
      streamingSource: 'cherryplay',
    });
    expect(result.mode).toBe('active');
    expect(result.canArchive).toBe(true);
    expect(result.showDangerSection).toBe(true);
  });
});
