const mockCreateParty = jest.fn();
const mockGetPartyUrl = jest.fn();

jest.mock('../../src/shared/services/partyService', () => ({
  partyService: {
    createParty: (...args: unknown[]) => mockCreateParty(...args),
    getPartyUrl: (...args: unknown[]) => mockGetPartyUrl(...args),
  },
}));

jest.mock('../../src/workspaces/party/partyPublishSync', () => ({
  markPartyPublishFullySynced: jest.fn(),
}));

import type { CreatePartyDto, PartyLifecycleState } from '../../src/shared/services/partyService';
import { resolvePartyEditorPhase } from '../../src/workspaces/party/partyEditorPhase';
import { finalizePartyCreation } from '../../src/workspaces/party/partyWorkspaceCreateFlow';

function createStore() {
  let lifecycleState: PartyLifecycleState | null = null;
  const setPartyLifecycleState = jest.fn((value: PartyLifecycleState) => {
    lifecycleState = value;
  });

  return {
    setPartyVerified: jest.fn(),
    setPartyLifecycleState,
    setIsListedInCatalog: jest.fn(),
    getLifecycleState: () => lifecycleState,
  };
}

function createDeps() {
  return {
    loadThemeAccess: jest.fn().mockResolvedValue(undefined),
    checkPartyExists: jest.fn().mockResolvedValue(true),
    setLinkedParty: jest.fn(),
    markAsDirty: jest.fn(),
    addNotification: jest.fn(),
  };
}

const createData = {
  name: 'Party',
  partyThemeId: 'basic',
  playlistData: { items: [], totalDuration: 0, totalTracks: 0 },
} as CreatePartyDto;

describe('party creation lifecycle reproduction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPartyUrl.mockResolvedValue('https://example.com/p/abc123');
  });

  it('shows draft-linked when the create response says draft', async () => {
    mockCreateParty.mockResolvedValue({
      id: 'party-1',
      shortCode: 'abc123',
      partyLifecycleState: 'draft',
    });
    const store = createStore();
    const deps = createDeps();

    await expect(finalizePartyCreation(store, createData, deps)).resolves.toBe(true);

    expect(store.getLifecycleState()).toBe('draft');
    expect(
      resolvePartyEditorPhase({
        isAuth: true,
        isClientOutdated: false,
        isCheckingParty: false,
        linkedParty: { id: 'party-1', shortCode: 'abc123' },
        partyLifecycleState: store.getLifecycleState(),
      }).phase,
    ).toBe('draft-linked');
  });

  it('falls back to draft-linked when the create response omits its lifecycle state', async () => {
    mockCreateParty.mockResolvedValue({
      id: 'party-1',
      shortCode: 'abc123',
    });
    const store = createStore();
    const deps = createDeps();

    await expect(finalizePartyCreation(store, createData, deps)).resolves.toBe(true);

    expect(store.setPartyLifecycleState).toHaveBeenCalledWith(undefined);
    expect(
      resolvePartyEditorPhase({
        isAuth: true,
        isClientOutdated: false,
        isCheckingParty: false,
        linkedParty: { id: 'party-1', shortCode: 'abc123' },
        partyLifecycleState: store.getLifecycleState(),
      }).phase,
    ).toBe('draft-linked');
  });

  it('shows ready when the create response says ready', async () => {
    mockCreateParty.mockResolvedValue({
      id: 'party-1',
      shortCode: 'abc123',
      partyLifecycleState: 'ready',
    });
    const store = createStore();
    const deps = createDeps();

    await expect(finalizePartyCreation(store, createData, deps)).resolves.toBe(true);

    expect(store.getLifecycleState()).toBe('ready');
    expect(
      resolvePartyEditorPhase({
        isAuth: true,
        isClientOutdated: false,
        isCheckingParty: false,
        linkedParty: { id: 'party-1', shortCode: 'abc123' },
        partyLifecycleState: store.getLifecycleState(),
      }).phase,
    ).toBe('ready');
  });

  it('reports unsuccessful finalization when verification fails', async () => {
    mockCreateParty.mockResolvedValue({
      id: 'party-1',
      shortCode: 'abc123',
      partyLifecycleState: 'ready',
    });
    const store = createStore();
    const deps = createDeps();
    deps.checkPartyExists.mockResolvedValue(false);

    await expect(finalizePartyCreation(store, createData, deps)).resolves.toBe(false);
  });
});
