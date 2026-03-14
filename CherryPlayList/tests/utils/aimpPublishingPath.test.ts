import {
  formatAimpPublishingPathError,
  startAimpPublishingBridge,
} from '../../src/shared/utils/aimpPublishingPath';

describe('startAimpPublishingBridge', () => {
  test('reports a startup error when the linked party is missing', async () => {
    const result = await startAimpPublishingBridge('party-1', {
      checkPartyExists: jest.fn().mockResolvedValue(false),
      connect: jest.fn().mockResolvedValue(undefined),
      joinPartyAsOrganizer: jest.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      status: 'error',
      error: formatAimpPublishingPathError('checkPartyExists'),
    });
  });

  test('reports a startup error when SignalR connect fails', async () => {
    const connectError = new Error('hub unavailable');
    const result = await startAimpPublishingBridge('party-1', {
      checkPartyExists: jest.fn().mockResolvedValue(true),
      connect: jest.fn().mockRejectedValue(connectError),
      joinPartyAsOrganizer: jest.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      status: 'error',
      error: formatAimpPublishingPathError('connect', connectError),
    });
  });

  test('reports a startup error when organizer join fails', async () => {
    const joinError = new Error('unauthorized');
    const result = await startAimpPublishingBridge('party-1', {
      checkPartyExists: jest.fn().mockResolvedValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
      joinPartyAsOrganizer: jest.fn().mockRejectedValue(joinError),
    });

    expect(result).toEqual({
      status: 'error',
      error: formatAimpPublishingPathError('joinPartyAsOrganizer', joinError),
    });
  });

  test('marks the publish path ready after the startup sequence succeeds', async () => {
    const result = await startAimpPublishingBridge('party-1', {
      checkPartyExists: jest.fn().mockResolvedValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
      joinPartyAsOrganizer: jest.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      status: 'ready',
      error: null,
    });
  });
});
