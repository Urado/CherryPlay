jest.mock('@cherryplay/components', () => ({
  getDefaultCustomizationSettings: () => ({}),
}));

jest.mock('../../src/shared/platform', () => ({
  getAppMode: () => 'demo',
}));

import type { LinkedParty } from '@core/types/project';

import { DEMO_LINKED_PARTY } from '../../src/shared/demo/demoPartyFixture';
import {
  applyDemoBlockedOverride,
  resolvePartyEditorPhase,
  shouldPreserveShellContentWhenBlocked,
} from '../../src/workspaces/party/partyEditorPhase';
import {
  demoResetToDefault,
  demoSetBlockedOverride,
  demoSetLinkedLifecycle,
  demoSetPartyNotFound,
  demoSetPreviewConnectionBreak,
  demoSetPreviewCustomizationSettings,
  demoSetPreviewLive,
  demoSetPreviewTheme,
  demoSetPreviewTrackNumber,
  demoSetUnlinkedDraft,
  demoSyncPreviewWithActual,
} from '../../src/workspaces/party/partyWorkspaceDemoActions';
import {
  resetPartyWorkspaceState,
  usePartyWorkspaceStore,
} from '../../src/workspaces/party/partyWorkspaceStore';

let mockLinkedParty: LinkedParty | null = DEMO_LINKED_PARTY;

jest.mock('../../src/shared/stores/projectStore', () => ({
  useProjectStore: {
    getState: () => ({
      meta: { linkedParty: mockLinkedParty },
      setLinkedParty: (party: LinkedParty | null) => {
        mockLinkedParty = party;
      },
    }),
  },
}));

describe('applyDemoBlockedOverride', () => {
  const linkedReadyInput = {
    isAuth: true,
    isClientOutdated: false,
    isCheckingParty: false,
    serverUnreachable: false,
    linkedParty: { id: 'p1', shortCode: 'abc' },
    partyLifecycleState: 'ready' as const,
  };

  it('returns base result when override is null', () => {
    const base = resolvePartyEditorPhase(linkedReadyInput);
    expect(applyDemoBlockedOverride(base, linkedReadyInput, null)).toEqual(base);
  });

  it('preserves phase while forcing blocked reason in demo', () => {
    const base = resolvePartyEditorPhase(linkedReadyInput);
    const result = applyDemoBlockedOverride(base, linkedReadyInput, 'auth');
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('auth');
    expect(result.phase).toBe('ready');
    expect(result.effectiveLifecycle).toBe('ready');
  });

  it('computes unblocked phase from linked party when real state is blocked', () => {
    const blockedInput = { ...linkedReadyInput, isAuth: false };
    const base = resolvePartyEditorPhase(blockedInput);
    expect(base.isBlocked).toBe(true);
    expect(base.phase).toBeNull();

    const result = applyDemoBlockedOverride(base, blockedInput, 'checking');
    expect(result.isBlocked).toBe(true);
    expect(result.blockedReason).toBe('checking');
    expect(result.phase).toBe('ready');
  });
});

describe('shouldPreserveShellContentWhenBlocked', () => {
  it('is true only when demo override is set', () => {
    expect(shouldPreserveShellContentWhenBlocked(null)).toBe(false);
    expect(shouldPreserveShellContentWhenBlocked('auth')).toBe(true);
  });
});

describe('partyWorkspaceDemoActions', () => {
  beforeEach(() => {
    resetPartyWorkspaceState();
    mockLinkedParty = DEMO_LINKED_PARTY;
  });

  it('demoSetUnlinkedDraft clears link and lifecycle', () => {
    demoSetUnlinkedDraft();
    expect(mockLinkedParty).toBeNull();
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBeNull();
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBeNull();
  });

  it('demoSetLinkedLifecycle syncs store and clears overrides', () => {
    demoSetBlockedOverride('auth');
    demoSetLinkedLifecycle('ready');
    expect(mockLinkedParty).toEqual(DEMO_LINKED_PARTY);
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBe('ready');
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBeNull();
  });

  it('demoSetBlockedOverride sets reversible blocked reason', () => {
    demoSetBlockedOverride('unreachable');
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBe('unreachable');
  });

  it('demoSetPartyNotFound sets linked party, server error and blocked overlay', () => {
    demoSetPartyNotFound();
    expect(mockLinkedParty).toEqual(DEMO_LINKED_PARTY);
    expect(usePartyWorkspaceStore.getState().serverError).toBe('Вечеринка не найдена на сервере');
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBe('party-not-found');
    expect(usePartyWorkspaceStore.getState().partyVerified).toBe(false);
  });

  it('demoSetPreviewLive enables live flag without blocking override', () => {
    demoSetPreviewLive();
    expect(usePartyWorkspaceStore.getState().demoPreviewLive).toBe(true);
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBeNull();
    expect(usePartyWorkspaceStore.getState().demoPreviewViewerStatusOverride).toBeNull();
    expect(usePartyWorkspaceStore.getState().isPreviewSynchronized).toBe(false);
  });

  it('demoSetPreviewConnectionBreak sets local preview scenario only', () => {
    demoSetPreviewTrackNumber(4);
    demoSetPreviewConnectionBreak('server_unreachable');
    expect(usePartyWorkspaceStore.getState().demoPreviewViewerStatusOverride).toBe(
      'server_unreachable',
    );
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBeNull();
    expect(usePartyWorkspaceStore.getState().serverUnreachable).toBe(false);
    expect(usePartyWorkspaceStore.getState().isPreviewSynchronized).toBe(false);
    expect(usePartyWorkspaceStore.getState().demoPreviewLive).toBe(true);
    expect(usePartyWorkspaceStore.getState().previewCurrentTrackNumber).toBe(4);
  });

  it('demoSetPreviewConnectionBreak reconnecting keeps selected track frozen', () => {
    demoSetPreviewTrackNumber(2);
    demoSetPreviewConnectionBreak('reconnecting');
    expect(usePartyWorkspaceStore.getState().demoPreviewViewerStatusOverride).toBe('connecting');
    expect(usePartyWorkspaceStore.getState().isReconnecting).toBe(false);
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBeNull();
    expect(usePartyWorkspaceStore.getState().isPreviewSynchronized).toBe(false);
    expect(usePartyWorkspaceStore.getState().previewCurrentTrackNumber).toBe(2);
    expect(usePartyWorkspaceStore.getState().demoPreviewLive).toBe(true);
  });

  it('demoSetPreviewTrackNumber enables local live with selected track', () => {
    demoSetPreviewTrackNumber(3);
    expect(usePartyWorkspaceStore.getState().demoPreviewLive).toBe(true);
    expect(usePartyWorkspaceStore.getState().previewCurrentTrackNumber).toBe(3);
    expect(usePartyWorkspaceStore.getState().isPreviewSynchronized).toBe(false);
  });

  it('demoSyncPreviewWithActual clears local preview overrides', () => {
    demoSetPreviewTrackNumber(2);
    demoSetPreviewConnectionBreak('organizer_offline');
    demoSyncPreviewWithActual();
    expect(usePartyWorkspaceStore.getState().isPreviewSynchronized).toBe(true);
    expect(usePartyWorkspaceStore.getState().previewCurrentTrackNumber).toBeNull();
    expect(usePartyWorkspaceStore.getState().demoPreviewViewerStatusOverride).toBeNull();
    expect(usePartyWorkspaceStore.getState().demoPreviewLive).toBe(false);
  });

  it('demoSetPreviewTheme preserves customization override on apply', () => {
    demoSetPreviewCustomizationSettings({ accentColor: '#ff00aa' });
    demoSetPreviewTheme('sakura');
    expect(usePartyWorkspaceStore.getState().previewThemeOverride).toBe('sakura');
    expect(usePartyWorkspaceStore.getState().previewCustomizationSettingsOverride).toEqual({
      accentColor: '#ff00aa',
    });
  });

  it('demoSetPreviewTheme sets defaults when no customization override exists', () => {
    demoSetPreviewTheme('basic');
    expect(usePartyWorkspaceStore.getState().previewCustomizationSettingsOverride).toEqual({});
  });

  it('demoResetToDefault restores DEMODK draft', () => {
    demoSetUnlinkedDraft();
    demoSetBlockedOverride('checking');
    demoSetPreviewLive();
    demoResetToDefault();
    expect(mockLinkedParty).toEqual(DEMO_LINKED_PARTY);
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBe('draft');
    expect(usePartyWorkspaceStore.getState().demoBlockedOverride).toBeNull();
    expect(usePartyWorkspaceStore.getState().demoPreviewLive).toBe(false);
  });
});
