import type { PlaybackState } from '@cherryplay/components';

import {
  resolvePartyEditorPhase,
  shouldShowPartyTrackDisplaySection,
} from '../../src/workspaces/party/partyEditorPhase';
import {
  isPlaybackLiveActive,
  resolvePreviewViewerStatusId,
} from '../../src/workspaces/party/partyPreviewLifecycle';
import { ERROR_PARTY_NOT_FOUND } from '../../src/workspaces/party/partyWorkspaceConstants';

describe('resolvePartyEditorPhase', () => {
  const baseInput = {
    isAuth: true,
    isClientOutdated: false,
    isCheckingParty: false,
    serverUnreachable: false,
    linkedParty: null,
    partyLifecycleState: null,
  };

  it('blocks when not authenticated', () => {
    const result = resolvePartyEditorPhase({ ...baseInput, isAuth: false });
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('auth');
    expect(result.phase).toBeNull();
  });

  it('blocks when client is outdated', () => {
    const result = resolvePartyEditorPhase({ ...baseInput, isClientOutdated: true });
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('outdated');
  });

  it('blocks while checking party', () => {
    const result = resolvePartyEditorPhase({ ...baseInput, isCheckingParty: true });
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('checking');
  });

  it('blocks when server is unreachable', () => {
    const result = resolvePartyEditorPhase({ ...baseInput, serverUnreachable: true });
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('unreachable');
  });

  it('returns draft-unlinked when no linked party', () => {
    const result = resolvePartyEditorPhase(baseInput);
    expect(result.isBlocked).toBe(false);
    expect(result.phase).toBe('draft-unlinked');
    expect(result.effectiveLifecycle).toBeNull();
  });

  it('returns draft-linked when linked with draft lifecycle', () => {
    const result = resolvePartyEditorPhase({
      ...baseInput,
      linkedParty: { id: 'p1', shortCode: 'abc' },
      partyLifecycleState: 'draft',
    });
    expect(result.phase).toBe('draft-linked');
    expect(result.effectiveLifecycle).toBe('draft');
  });

  it('treats null lifecycle as draft when linked', () => {
    const result = resolvePartyEditorPhase({
      ...baseInput,
      linkedParty: { id: 'p1', shortCode: 'abc' },
      partyLifecycleState: null,
    });
    expect(result.phase).toBe('draft-linked');
    expect(result.effectiveLifecycle).toBe('draft');
  });

  it('returns ready when linked party lifecycle is ready', () => {
    const result = resolvePartyEditorPhase({
      ...baseInput,
      linkedParty: { id: 'p1', shortCode: 'abc' },
      partyLifecycleState: 'ready',
    });
    expect(result.phase).toBe('ready');
    expect(result.effectiveLifecycle).toBe('ready');
  });

  it('returns completed when linked party lifecycle is completed', () => {
    const result = resolvePartyEditorPhase({
      ...baseInput,
      linkedParty: { id: 'p1', shortCode: 'abc' },
      partyLifecycleState: 'completed',
    });
    expect(result.phase).toBe('completed');
    expect(result.effectiveLifecycle).toBe('completed');
  });

  it('blocked reasons take priority over phase', () => {
    const result = resolvePartyEditorPhase({
      ...baseInput,
      isAuth: false,
      linkedParty: { id: 'p1', shortCode: 'abc' },
      partyLifecycleState: 'ready',
    });
    expect(result.isBlocked).toBe(true);
    expect(result.phase).toBeNull();
  });

  it('blocks with party-not-found while preserving phase for linked party', () => {
    const result = resolvePartyEditorPhase({
      ...baseInput,
      linkedParty: { id: 'p1', shortCode: 'abc' },
      partyLifecycleState: 'draft',
      serverError: ERROR_PARTY_NOT_FOUND,
    });
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('party-not-found');
    expect(result.phase).toBe('draft-linked');
    expect(result.effectiveLifecycle).toBe('draft');
  });
});

describe('shouldShowPartyTrackDisplaySection', () => {
  it('shows track display for draft-linked and ready', () => {
    expect(shouldShowPartyTrackDisplaySection('draft-linked')).toBe(true);
    expect(shouldShowPartyTrackDisplaySection('ready')).toBe(true);
  });

  it('hides track display for draft-unlinked and completed', () => {
    expect(shouldShowPartyTrackDisplaySection('draft-unlinked')).toBe(false);
    expect(shouldShowPartyTrackDisplaySection('completed')).toBe(false);
    expect(shouldShowPartyTrackDisplaySection(null)).toBe(false);
  });
});

describe('resolvePreviewViewerStatusId', () => {
  const idleSessionPlayback: PlaybackState = {
    currentTrackId: null,
    status: 'idle',
    position: 0,
    duration: 0,
    volume: 1,
    mode: 'session',
    playedTrackIds: [],
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('returns live when playback is actively playing', () => {
    expect(resolvePreviewViewerStatusId({ status: 'playing' } as PlaybackState, 'ready')).toBe(
      'live',
    );
    expect(resolvePreviewViewerStatusId({ status: 'playing' } as PlaybackState, 'completed')).toBe(
      'live',
    );
  });

  it('returns live when session is paused mid-stream', () => {
    const pausedSession: PlaybackState = { ...idleSessionPlayback, status: 'paused' };
    expect(resolvePreviewViewerStatusId(pausedSession, 'ready')).toBe('live');
  });

  it('maps lifecycle when playback is null', () => {
    expect(resolvePreviewViewerStatusId(null, 'completed')).toBe('party_ended');
    expect(resolvePreviewViewerStatusId(null, 'ready')).toBe('starting_soon');
    expect(resolvePreviewViewerStatusId(null, 'draft')).toBe('draft');
    expect(resolvePreviewViewerStatusId(null, null)).toBe('draft');
  });

  it('maps lifecycle when session mode has idle snapshot (non-null playback)', () => {
    expect(resolvePreviewViewerStatusId(idleSessionPlayback, 'completed')).toBe('party_ended');
    expect(resolvePreviewViewerStatusId(idleSessionPlayback, 'ready')).toBe('starting_soon');
    expect(resolvePreviewViewerStatusId(idleSessionPlayback, 'draft')).toBe('draft');
    expect(resolvePreviewViewerStatusId(idleSessionPlayback, null)).toBe('draft');
  });
});

describe('isPlaybackLiveActive', () => {
  const idleSessionPlayback: PlaybackState = {
    currentTrackId: null,
    status: 'idle',
    position: 0,
    duration: 0,
    volume: 1,
    mode: 'session',
    playedTrackIds: [],
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('is false for null and idle session snapshots', () => {
    expect(isPlaybackLiveActive(null)).toBe(false);
    expect(isPlaybackLiveActive(idleSessionPlayback)).toBe(false);
  });

  it('is true for playing and paused session playback', () => {
    expect(isPlaybackLiveActive({ ...idleSessionPlayback, status: 'playing' })).toBe(true);
    expect(isPlaybackLiveActive({ ...idleSessionPlayback, status: 'paused' })).toBe(true);
  });
});
