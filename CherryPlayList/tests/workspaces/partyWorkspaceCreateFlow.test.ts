const mockCreateParty = jest.fn();
const mockGetPartyUrl = jest.fn();
const mockCheckServerReachable = jest.fn();

jest.mock('../../src/shared/services/partyService', () => ({
  partyService: {
    createParty: (...args: unknown[]) => mockCreateParty(...args),
    getPartyUrl: (...args: unknown[]) => mockGetPartyUrl(...args),
    checkServerReachable: (...args: unknown[]) => mockCheckServerReachable(...args),
  },
}));

jest.mock('../../src/workspaces/party/partyWorkspaceUtils', () => ({
  ERROR_CONNECTION: 'Ошибка соединения с сервером',
}));

import type { CreatePartyDto } from '../../src/shared/services/partyService';
import { ERROR_CONNECTION } from '../../src/workspaces/party/partyWorkspaceConstants';
import {
  finalizePartyCreation,
  handlePartyCreationFailure,
} from '../../src/workspaces/party/partyWorkspaceCreateFlow';

function createMockStore() {
  return {
    setPartyVerified: jest.fn(),
    setPartyLifecycleState: jest.fn(),
    setServerUnreachable: jest.fn(),
    setServerError: jest.fn(),
  };
}

function createFinalizeDeps() {
  return {
    loadThemeAccess: jest.fn().mockResolvedValue(undefined),
    checkPartyExists: jest.fn().mockResolvedValue(true),
    setLinkedParty: jest.fn(),
    markAsDirty: jest.fn(),
    addNotification: jest.fn(),
  };
}

function createFailureDeps() {
  return {
    addNotification: jest.fn(),
    startReconnectTimer: jest.fn(),
  };
}

const createData = {
  name: 'Party',
  partyThemeId: 'cyberpunk',
  playlistData: { items: [], totalDuration: 0, totalTracks: 0 },
} as CreatePartyDto;

describe('finalizePartyCreation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateParty.mockResolvedValue({
      id: 'party-1',
      shortCode: 'abc123',
      partyLifecycleState: 'draft',
    });
    mockGetPartyUrl.mockResolvedValue('https://example.com/p/abc123');
  });

  it('links party and notifies on success', async () => {
    const store = createMockStore();
    const deps = createFinalizeDeps();

    await finalizePartyCreation(store, createData, 'Created!', deps);

    expect(mockCreateParty).toHaveBeenCalledWith(createData);
    expect(deps.loadThemeAccess).toHaveBeenCalledWith(true);
    expect(deps.checkPartyExists).toHaveBeenCalledWith('party-1');
    expect(deps.setLinkedParty).toHaveBeenCalledWith({
      id: 'party-1',
      shortCode: 'abc123',
      url: 'https://example.com/p/abc123',
    });
    expect(store.setPartyVerified).toHaveBeenCalledWith(true);
    expect(store.setPartyLifecycleState).toHaveBeenCalledWith('draft');
    expect(deps.markAsDirty).toHaveBeenCalled();
    expect(deps.addNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Created!',
    });
  });

  it('returns early when party is not found after creation', async () => {
    const store = createMockStore();
    const deps = createFinalizeDeps();
    deps.checkPartyExists.mockResolvedValue(false);

    await finalizePartyCreation(store, createData, 'Created!', deps);

    expect(deps.setLinkedParty).not.toHaveBeenCalled();
    expect(store.setPartyVerified).not.toHaveBeenCalled();
    expect(deps.addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Вечеринка создана, но сервер недоступен',
    });
  });

  it('returns early with specific error when getPartyUrl fails after successful create', async () => {
    const store = createMockStore();
    const deps = createFinalizeDeps();
    mockGetPartyUrl.mockRejectedValue(new Error('Network error'));

    await finalizePartyCreation(store, createData, 'Created!', deps);

    expect(mockCreateParty).toHaveBeenCalledWith(createData);
    expect(deps.checkPartyExists).toHaveBeenCalledWith('party-1');
    expect(deps.setLinkedParty).not.toHaveBeenCalled();
    expect(store.setPartyVerified).not.toHaveBeenCalled();
    expect(deps.addNotification).toHaveBeenCalledWith({
      type: 'error',
      message:
        'Вечеринка создана, но не удалось получить ссылку. Попробуйте обновить или переподключиться.',
    });
  });
});

describe('handlePartyCreationFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks server unreachable and starts reconnect timer when offline', async () => {
    const store = createMockStore();
    const deps = createFailureDeps();
    mockCheckServerReachable.mockResolvedValue(false);

    await handlePartyCreationFailure(store, deps, 'Create failed');

    expect(store.setServerUnreachable).toHaveBeenCalledWith(true);
    expect(deps.startReconnectTimer).toHaveBeenCalledWith(null);
    expect(store.setServerError).not.toHaveBeenCalled();
    expect(store.setPartyVerified).toHaveBeenCalledWith(false);
    expect(deps.addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Create failed',
    });
  });

  it('sets connection error when server is reachable', async () => {
    const store = createMockStore();
    const deps = createFailureDeps();
    mockCheckServerReachable.mockResolvedValue(true);

    await handlePartyCreationFailure(store, deps, 'Publish failed');

    expect(store.setServerUnreachable).not.toHaveBeenCalled();
    expect(deps.startReconnectTimer).not.toHaveBeenCalled();
    expect(store.setServerError).toHaveBeenCalledWith(ERROR_CONNECTION);
    expect(store.setPartyVerified).toHaveBeenCalledWith(false);
    expect(deps.addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Publish failed',
    });
  });
});
