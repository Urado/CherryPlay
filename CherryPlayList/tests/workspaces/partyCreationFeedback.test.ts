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

import type { CreatePartyDto } from '../../src/shared/services/partyService';
import { notifyParentAfterPartyCreated } from '../../src/workspaces/party/components/PartySettingsContent';
import { finalizePartyCreation } from '../../src/workspaces/party/partyWorkspaceCreateFlow';

const createData = {
  name: 'Party',
  partyThemeId: 'basic',
  playlistData: { items: [], totalDuration: 0, totalTracks: 0 },
} as CreatePartyDto;

function createStore() {
  return {
    setPartyVerified: jest.fn(),
    setPartyLifecycleState: jest.fn(),
    setIsListedInCatalog: jest.fn(),
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

describe('party creation feedback', () => {
  beforeEach(() => {
    mockCreateParty.mockReset().mockResolvedValue({
      id: 'party-1',
      shortCode: 'abc123',
      partyLifecycleState: 'ready',
    });
    mockGetPartyUrl.mockReset().mockRejectedValue(new Error('offline'));
  });

  it('notifies the parent once when party creation succeeds', () => {
    const onPartyCreated = jest.fn();

    notifyParentAfterPartyCreated(true, onPartyCreated);

    expect(onPartyCreated).toHaveBeenCalledTimes(1);
  });

  it('does not notify the parent when party creation fails', () => {
    const onPartyCreated = jest.fn();

    notifyParentAfterPartyCreated(false, onPartyCreated);

    expect(onPartyCreated).not.toHaveBeenCalled();
  });

  it('returns false when theme access loading fails', async () => {
    const store = createStore();
    const deps = createDeps();
    deps.loadThemeAccess.mockRejectedValue(new Error('offline'));

    await expect(finalizePartyCreation(store as never, createData, deps)).resolves.toBe(false);
    expect(deps.setLinkedParty).not.toHaveBeenCalled();
  });

  it('returns false when the existence check throws', async () => {
    const store = createStore();
    const deps = createDeps();
    deps.checkPartyExists.mockRejectedValue(new Error('offline'));

    await expect(finalizePartyCreation(store as never, createData, deps)).resolves.toBe(false);
    expect(deps.setLinkedParty).not.toHaveBeenCalled();
  });

  it('returns false when the created party does not exist', async () => {
    const store = createStore();
    const deps = createDeps();
    deps.checkPartyExists.mockResolvedValue(false);

    await expect(finalizePartyCreation(store as never, createData, deps)).resolves.toBe(false);
    expect(deps.setLinkedParty).not.toHaveBeenCalled();
  });

  it('returns false when retrieving the party URL fails', async () => {
    const store = createStore();
    const deps = createDeps();

    await expect(finalizePartyCreation(store as never, createData, deps)).resolves.toBe(false);
    expect(deps.setLinkedParty).not.toHaveBeenCalled();
  });
});
