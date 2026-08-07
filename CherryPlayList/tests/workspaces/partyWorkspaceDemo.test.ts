jest.mock('@cherryplay/components', () => ({
  getDefaultCustomizationSettings: () => ({}),
}));

jest.mock('../../src/shared/platform', () => ({
  getAppMode: () => 'demo',
}));

import type { LinkedParty } from '@core/types/project';

import { DEMO_LINKED_PARTY } from '../../src/shared/demo/demoPartyFixture';
import {
  resetEditorDemoState,
  usePartyEditorDemoStore,
} from '../../src/workspaces/party/partyEditorDemoStore';
import {
  applyDemoBlockedOverride,
  resolvePartyEditorPhase,
  shouldPreserveShellContentWhenBlocked,
} from '../../src/workspaces/party/partyEditorPhase';
import {
  resetPreviewScenario,
  setPreviewLifecycleOverride,
  setPreviewMockLive,
  syncPreviewWithProduction,
} from '../../src/workspaces/party/partyPreviewScenarioActions';
import {
  initialPartyPreviewScenarioState,
  resetPartyPreviewScenarioStore,
  usePartyPreviewScenarioStore,
} from '../../src/workspaces/party/partyPreviewScenarioStore';
import {
  demoResetToDefault,
  demoSetBlockedOverride,
  demoSetLinkedLifecycle,
  demoSetPartyNotFound,
  demoSetUnlinkedDraft,
} from '../../src/workspaces/party/partyWorkspaceDemoActions';
import { clearPartyWorkspaceLinkedPartyCheck } from '../../src/workspaces/party/partyWorkspaceReconnectRefs';
import {
  resetPartyLinkState,
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
    resetPartyPreviewScenarioStore();
    resetEditorDemoState();
    mockLinkedParty = DEMO_LINKED_PARTY;
  });

  it('demoSetUnlinkedDraft clears link and lifecycle', () => {
    demoSetUnlinkedDraft();
    expect(mockLinkedParty).toBeNull();
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBeNull();
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBeNull();
  });

  it('demoSetLinkedLifecycle syncs store and clears editor demo overrides only', () => {
    setPreviewMockLive();
    demoSetBlockedOverride('auth');
    demoSetLinkedLifecycle('ready');
    expect(mockLinkedParty).toEqual(DEMO_LINKED_PARTY);
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBe('ready');
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBeNull();
    expect(usePartyPreviewScenarioStore.getState().mockLiveEnabled).toBe(true);
  });

  it('demoSetBlockedOverride sets reversible blocked reason in editor demo store', () => {
    demoSetBlockedOverride('unreachable');
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBe('unreachable');
  });

  it('demoSetPartyNotFound sets linked party, server error and blocked overlay', () => {
    demoSetPartyNotFound();
    expect(mockLinkedParty).toEqual(DEMO_LINKED_PARTY);
    expect(usePartyWorkspaceStore.getState().serverError).toBe('Вечеринка не найдена на сервере');
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBe('party-not-found');
    expect(usePartyWorkspaceStore.getState().partyVerified).toBe(false);
  });

  it('demoResetToDefault restores DEMODK ready and resets scenario', () => {
    demoSetUnlinkedDraft();
    demoSetBlockedOverride('checking');
    setPreviewMockLive();
    demoResetToDefault();
    expect(mockLinkedParty).toEqual(DEMO_LINKED_PARTY);
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBe('ready');
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBeNull();
    expect(usePartyPreviewScenarioStore.getState()).toEqual(initialPartyPreviewScenarioState);
  });

  it('exiting party-not-found via demoSetLinkedLifecycle clears serverError and unblocks editor', () => {
    demoSetPartyNotFound();
    demoSetLinkedLifecycle('ready');

    const store = usePartyWorkspaceStore.getState();
    expect(store.serverError).toBeNull();
    expect(store.partyVerified).toBe(true);
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBeNull();

    const result = resolvePartyEditorPhase({
      isAuth: true,
      isClientOutdated: false,
      isCheckingParty: false,
      serverUnreachable: false,
      linkedParty: DEMO_LINKED_PARTY,
      partyLifecycleState: 'ready',
      serverError: store.serverError,
    });
    expect(result.isBlocked).toBe(false);
    expect(result.blockedReason).toBeNull();
  });

  it('exiting party-not-found via demoResetToDefault clears serverError and unblocks editor', () => {
    demoSetPartyNotFound();
    demoResetToDefault();

    const store = usePartyWorkspaceStore.getState();
    expect(store.serverError).toBeNull();
    expect(store.partyVerified).toBe(true);
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBeNull();

    const result = resolvePartyEditorPhase({
      isAuth: true,
      isClientOutdated: false,
      isCheckingParty: false,
      serverUnreachable: false,
      linkedParty: DEMO_LINKED_PARTY,
      partyLifecycleState: 'draft',
      serverError: store.serverError,
    });
    expect(result.isBlocked).toBe(false);
    expect(result.blockedReason).toBeNull();
  });
});

describe('reset matrix — production vs scenario vs editor demo', () => {
  beforeEach(() => {
    resetPartyWorkspaceState();
    resetPartyPreviewScenarioStore();
    resetEditorDemoState();
    mockLinkedParty = DEMO_LINKED_PARTY;
  });

  it('resetPartyWorkspaceState does not change scenario or editor demo stores', () => {
    setPreviewMockLive();
    usePartyEditorDemoStore.getState().setBlockedOverride('auth');
    const scenarioBefore = usePartyPreviewScenarioStore.getState();
    const editorDemoBefore = usePartyEditorDemoStore.getState();

    resetPartyWorkspaceState();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(scenarioBefore);
    expect(usePartyEditorDemoStore.getState()).toEqual(editorDemoBefore);
  });

  it('resetPartyLinkState does not change scenario or editor demo stores', () => {
    setPreviewMockLive();
    usePartyEditorDemoStore.getState().setBlockedOverride('checking');
    const scenarioBefore = usePartyPreviewScenarioStore.getState();
    const editorDemoBefore = usePartyEditorDemoStore.getState();

    resetPartyLinkState();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(scenarioBefore);
    expect(usePartyEditorDemoStore.getState()).toEqual(editorDemoBefore);
  });

  it('simulated unlink (resetPartyLinkState + setLinkedParty null) does not change scenario store', () => {
    setPreviewMockLive();
    const scenarioBefore = usePartyPreviewScenarioStore.getState();

    resetPartyLinkState();
    mockLinkedParty = null;

    expect(usePartyPreviewScenarioStore.getState()).toEqual(scenarioBefore);
  });

  it('handleResetAndCreateNewParty equivalent unlink does not change scenario store', () => {
    setPreviewMockLive();
    setPreviewLifecycleOverride('ready');
    const scenarioBefore = usePartyPreviewScenarioStore.getState();

    clearPartyWorkspaceLinkedPartyCheck();
    resetPartyLinkState();
    mockLinkedParty = null;

    expect(usePartyPreviewScenarioStore.getState()).toEqual(scenarioBefore);
    expect(mockLinkedParty).toBeNull();
  });

  it('syncPreviewWithProduction clears scenario only', () => {
    usePartyWorkspaceStore.getState().setPartyName('Test Party');
    setPreviewMockLive();

    syncPreviewWithProduction();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(initialPartyPreviewScenarioState);
    expect(usePartyWorkspaceStore.getState().partyName).toBe('Test Party');
  });

  it('resetEditorDemoState does not change scenario or production stores', () => {
    setPreviewMockLive();
    usePartyWorkspaceStore.getState().setPartyName('Test Party');
    usePartyWorkspaceStore.getState().setServerError('Вечеринка не найдена на сервере');
    usePartyEditorDemoStore.getState().setBlockedOverride('party-not-found');
    const scenarioBefore = usePartyPreviewScenarioStore.getState();
    const productionBefore = {
      partyName: usePartyWorkspaceStore.getState().partyName,
      serverError: usePartyWorkspaceStore.getState().serverError,
      partyVerified: usePartyWorkspaceStore.getState().partyVerified,
    };

    resetEditorDemoState();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(scenarioBefore);
    expect(usePartyWorkspaceStore.getState().partyName).toBe(productionBefore.partyName);
    expect(usePartyWorkspaceStore.getState().serverError).toBe(productionBefore.serverError);
    expect(usePartyWorkspaceStore.getState().partyVerified).toBe(productionBefore.partyVerified);
    expect(usePartyEditorDemoStore.getState().blockedOverride).toBeNull();
  });

  it('resetPreviewScenario does not change production or editor demo store', () => {
    usePartyWorkspaceStore.getState().setPartyName('Test Party');
    usePartyWorkspaceStore.getState().setServerError('Вечеринка не найдена на сервере');
    usePartyWorkspaceStore.getState().setPartyVerified(false);
    usePartyEditorDemoStore.getState().setBlockedOverride('party-not-found');
    setPreviewMockLive();

    const productionBefore = {
      partyName: usePartyWorkspaceStore.getState().partyName,
      serverError: usePartyWorkspaceStore.getState().serverError,
      partyVerified: usePartyWorkspaceStore.getState().partyVerified,
      partyLifecycleState: usePartyWorkspaceStore.getState().partyLifecycleState,
    };
    const editorDemoBefore = usePartyEditorDemoStore.getState();

    resetPreviewScenario();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(initialPartyPreviewScenarioState);
    expect(usePartyWorkspaceStore.getState().partyName).toBe(productionBefore.partyName);
    expect(usePartyWorkspaceStore.getState().serverError).toBe(productionBefore.serverError);
    expect(usePartyWorkspaceStore.getState().partyVerified).toBe(productionBefore.partyVerified);
    expect(usePartyWorkspaceStore.getState().partyLifecycleState).toBe(
      productionBefore.partyLifecycleState,
    );
    expect(usePartyEditorDemoStore.getState()).toEqual(editorDemoBefore);
  });
});
