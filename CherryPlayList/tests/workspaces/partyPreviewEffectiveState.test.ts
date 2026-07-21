jest.mock('../../src/workspaces/party/usePartyWorkspace', () => ({
  usePartyWorkspaceRuntime: jest.fn(),
}));

import type { PlaybackState } from '@cherryplay/components';

import {
  resolvePartyPreviewEffectiveState,
  type PartyPreviewProductionSnapshot,
} from '../../src/workspaces/party/partyPreviewEffectiveState';
import { DEMO_MOCK_LIVE_PLAYBACK } from '../../src/workspaces/party/partyPreviewMockPlayback';
import { initialPartyPreviewScenarioState } from '../../src/workspaces/party/partyPreviewScenarioStore';

const productionBase: PartyPreviewProductionSnapshot = {
  themeId: 'cyberpunk',
  customizationSettings: { theme: 'cyberpunk' },
  playbackState: {
    currentTrackId: 'runtime-track',
    status: 'playing',
    position: 10,
    duration: 200,
    volume: 0.8,
    mode: 'session',
    playedTrackIds: [],
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: '2025-06-01T10:00:00.000Z',
  } as PlaybackState,
  partyLifecycleState: 'ready',
  isLinked: true,
};

describe('resolvePartyPreviewEffectiveState', () => {
  it('uses runtime lifecycle and playback when synchronized and linked', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      initialPartyPreviewScenarioState,
      ['track-a', 'track-b'],
      null,
    );

    expect(result).toEqual({
      isSynchronized: true,
      previewLifecycleState: 'ready',
      effectivePlaybackState: productionBase.playbackState,
      previewViewerStatusOverride: null,
      effectiveThemeId: 'cyberpunk',
      effectiveCustomizationSettings: { theme: 'cyberpunk' },
      isEffectiveThemeUnavailable: false,
    });
  });

  it('returns null lifecycle when synchronized but unlinked', () => {
    const result = resolvePartyPreviewEffectiveState(
      { ...productionBase, isLinked: false, partyLifecycleState: 'draft' },
      initialPartyPreviewScenarioState,
      [],
      null,
    );

    expect(result.previewLifecycleState).toBeNull();
    expect(result.effectivePlaybackState).toBe(productionBase.playbackState);
    expect(result.isEffectiveThemeUnavailable).toBe(false);
  });

  it('ignores stale overrides when synchronized', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: true,
        lifecycleOverride: 'completed',
        themeOverride: 'retro',
        customizationSettingsOverride: { accent: 'gold' },
        mockLiveEnabled: true,
        viewerStatusOverride: 'server_unreachable',
        currentTrackNumber: 2,
      },
      ['track-a', 'track-b'],
      ['cyberpunk'],
    );

    expect(result).toEqual({
      isSynchronized: true,
      previewLifecycleState: 'ready',
      effectivePlaybackState: productionBase.playbackState,
      previewViewerStatusOverride: null,
      effectiveThemeId: 'cyberpunk',
      effectiveCustomizationSettings: { theme: 'cyberpunk' },
      isEffectiveThemeUnavailable: false,
    });
  });

  it('applies detached lifecycle override only when not synchronized', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        lifecycleOverride: 'completed',
      },
      [],
      null,
    );

    expect(result.previewLifecycleState).toBe('completed');
    expect(result.effectivePlaybackState).toBeNull();
    expect(result.isEffectiveThemeUnavailable).toBe(false);
  });

  it('builds mock live playback as playing when detached without viewer override', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        mockLiveEnabled: true,
        lifecycleOverride: 'ready',
        currentTrackNumber: 2,
      },
      ['track-a', 'track-b', 'track-c'],
      null,
    );

    expect(result.effectivePlaybackState).toMatchObject({
      currentTrackId: 'track-b',
      status: 'playing',
    });
    expect(result.previewViewerStatusOverride).toBeNull();
    expect(result.isEffectiveThemeUnavailable).toBe(false);
  });

  it('bounds track number to playlist length when non-empty', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        mockLiveEnabled: true,
        currentTrackNumber: 99,
      },
      ['only-track'],
      null,
    );

    expect(result.effectivePlaybackState?.currentTrackId).toBe('only-track');
  });

  it('uses demo fallback track id when playlist is empty', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        mockLiveEnabled: true,
        currentTrackNumber: 1,
      },
      [],
      null,
    );

    expect(result.effectivePlaybackState?.currentTrackId).toBe(
      DEMO_MOCK_LIVE_PLAYBACK.currentTrackId,
    );
  });

  it('sets paused playback for connection-break viewer override', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        mockLiveEnabled: true,
        viewerStatusOverride: 'server_unreachable',
        lifecycleOverride: 'ready',
        currentTrackNumber: 1,
      },
      ['track-a'],
      null,
    );

    expect(result.effectivePlaybackState?.status).toBe('paused');
    expect(result.previewViewerStatusOverride).toBe('server_unreachable');
  });

  it('applies detached theme and customization overrides with production fallback', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        themeOverride: 'retro',
        customizationSettingsOverride: { accent: 'gold' },
      },
      [],
      null,
    );

    expect(result.effectiveThemeId).toBe('retro');
    expect(result.effectiveCustomizationSettings).toEqual({ accent: 'gold' });
    expect(result.isEffectiveThemeUnavailable).toBe(false);
  });

  it('falls back to production theme when detached without theme override', () => {
    const result = resolvePartyPreviewEffectiveState(
      { ...productionBase, themeId: 'minimal' },
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        lifecycleOverride: 'draft',
      },
      [],
      null,
    );

    expect(result.effectiveThemeId).toBe('minimal');
    expect(result.effectiveCustomizationSettings).toEqual(productionBase.customizationSettings);
  });

  it('marks effective theme unavailable when not in visibleThemeIds', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        themeOverride: 'retro',
      },
      [],
      ['cyberpunk', 'minimal'],
    );

    expect(result.effectiveThemeId).toBe('retro');
    expect(result.isEffectiveThemeUnavailable).toBe(true);
  });

  it('treats theme as available when visibleThemeIds is null', () => {
    const result = resolvePartyPreviewEffectiveState(
      productionBase,
      {
        ...initialPartyPreviewScenarioState,
        isSynchronized: false,
        themeOverride: 'retro',
      },
      [],
      null,
    );

    expect(result.isEffectiveThemeUnavailable).toBe(false);
  });
});
