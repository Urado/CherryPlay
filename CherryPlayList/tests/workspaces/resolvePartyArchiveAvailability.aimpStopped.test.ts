import { resolvePartyArchiveAvailability } from '../../src/workspaces/party/resolvePartyArchiveAvailability';

describe('resolvePartyArchiveAvailability AIMP stopped (Конец)', () => {
  it('allows archive when AIMP live stream has stopped', () => {
    const result = resolvePartyArchiveAvailability({
      partyLifecycleState: 'ready',
      sessionMode: 'preparation',
      streamingSource: 'aimp',
      aimpLiveStreamStarted: true,
      aimpPlaybackStatus: 'stopped',
    });
    expect(result.mode).toBe('active');
    expect(result.canArchive).toBe(true);
    expect(result.isBlockedByLive).toBe(false);
  });
});
