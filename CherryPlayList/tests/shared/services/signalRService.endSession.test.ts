import { HubConnectionState } from '@microsoft/signalr';

import { signalRService } from '../../../src/shared/services/signalRService';

interface TestSignalRService {
  connection: { state: HubConnectionState; invoke: jest.Mock } | null;
  endSession: (partyId: string) => Promise<void>;
  endSessionOrThrow: (partyId: string) => Promise<void>;
}

const service = signalRService as unknown as TestSignalRService;

describe('signalRService.endSessionOrThrow', () => {
  beforeEach(() => {
    service.connection = {
      state: HubConnectionState.Connected,
      invoke: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    service.connection = null;
    jest.restoreAllMocks();
  });

  it('rejects when SignalR is disconnected', async () => {
    service.connection = null;

    await expect(service.endSessionOrThrow('party-1')).rejects.toThrow('Нет подключения к серверу');
  });

  it('propagates EndSession invocation failures', async () => {
    const error = new Error('EndSession failed');
    service.connection!.invoke.mockRejectedValue(error);

    await expect(service.endSessionOrThrow('party-1')).rejects.toBe(error);
  });

  it('keeps the existing endSession best-effort behavior', async () => {
    const error = new Error('EndSession failed');
    service.connection!.invoke.mockRejectedValue(error);
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.endSession('party-1')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });
});
