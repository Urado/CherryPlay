import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import {
  getPartyPlaybackSourceAdapter,
  resolvePartyPlaybackSourceState,
} from '../../src/workspaces/party/partyPlaybackSource';

const createAimpBridgeState = (status: 'playing' | 'paused' | 'stopped', positionMs = 0) => ({
  ...createInitialAimpBridgeState(),
  sourceSelection: 'aimp' as const,
  liveStreamStarted: true,
  playbackSnapshot: {
    revision: 1,
    status,
    currentTrackKey: null,
    positionMs,
    durationMs: 240_000,
    isMuted: false,
    receivedAt: '',
    sentAt: '',
  },
});

describe('party playback source adapters', () => {
  it('uses CherryPlay while the selected source is unavailable', () => {
    const state = resolvePartyPlaybackSourceState(undefined, {
      sessionMode: 'session',
      playerPlaybackStatus: 'playing',
      aimpBridgeState: createInitialAimpBridgeState(),
    });

    expect(state.playbackStatus).toBe('playing');
    expect(state.archiveActivity).toBe('playing');
  });

  it('maps CherryPlay session state to the shared playback interface', () => {
    const state = resolvePartyPlaybackSourceState('cherryPlayPlayer', {
      sessionMode: 'session',
      playerPlaybackStatus: 'playing',
      aimpBridgeState: createInitialAimpBridgeState(),
    });

    expect(state).toMatchObject({
      sessionActive: true,
      headerActive: true,
      playbackStatus: 'playing',
      headerPlaybackStatus: 'playing',
      archiveActivity: 'playing',
    });
    expect(getPartyPlaybackSourceAdapter('cherryPlayPlayer').completionDetection).toBe(
      'track-event',
    );
  });

  it('maps AIMP playback and pause through the shared interface', () => {
    const playing = resolvePartyPlaybackSourceState('aimp', {
      sessionMode: 'preparation',
      playerPlaybackStatus: 'idle',
      aimpBridgeState: createAimpBridgeState('playing'),
    });
    const paused = resolvePartyPlaybackSourceState('aimp', {
      sessionMode: 'preparation',
      playerPlaybackStatus: 'idle',
      aimpBridgeState: createAimpBridgeState('paused'),
    });

    expect(playing).toMatchObject({
      sessionActive: true,
      headerActive: true,
      playbackStatus: 'playing',
      archiveActivity: 'playing',
    });
    expect(paused).toMatchObject({
      sessionActive: true,
      headerActive: true,
      playbackStatus: 'paused',
      headerPlaybackStatus: null,
      archiveActivity: 'paused',
    });
    expect(getPartyPlaybackSourceAdapter('aimp').completionDetection).toBe('playback-snapshot');
  });

  it('keeps AIMP live session active while playback waits or is stopped', () => {
    const waiting = resolvePartyPlaybackSourceState('aimp', {
      sessionMode: 'preparation',
      playerPlaybackStatus: 'idle',
      aimpBridgeState: createAimpBridgeState('stopped'),
    });

    expect(waiting).toMatchObject({
      sessionActive: true,
      headerActive: false,
      playbackStatus: 'stopped',
      archiveActivity: 'inactive',
    });
  });
});
