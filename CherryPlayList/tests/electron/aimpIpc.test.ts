const handlers = new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>();
const getAllWindowsMock = jest.fn(() => []);
const handleMock = jest.fn(
  (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
    handlers.set(channel, handler);
  },
);
const subscribeMock = jest.fn();
const subscribeLogMock = jest.fn();
const setLiveStreamStartedMock = jest.fn();

jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: getAllWindowsMock,
  },
  ipcMain: {
    handle: handleMock,
  },
}));

jest.mock('../../electron/aimp/service', () => ({
  aimpIntegrationService: {
    subscribe: subscribeMock,
    subscribeLog: subscribeLogMock,
    getState: jest.fn(),
    setSourceSelection: jest.fn(),
    setLiveStreamStarted: setLiveStreamStartedMock,
  },
}));

import { registerAimpHandlers, unregisterAimpHandlers } from '../../electron/ipc/aimp';

describe('AIMP IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
    getAllWindowsMock.mockClear();
    handleMock.mockClear();
    subscribeMock.mockClear();
    subscribeLogMock.mockClear();
    setLiveStreamStartedMock.mockReset();
  });

  afterEach(() => {
    unregisterAimpHandlers();
  });

  test('returns a failure response when live-stream guardrails reject the request', async () => {
    const unsubscribe = jest.fn();
    subscribeMock.mockReturnValue(unsubscribe);
    setLiveStreamStartedMock.mockImplementation(() => {
      throw new Error('AIMP live streaming can start only when the selected source is AIMP.');
    });

    registerAimpHandlers();
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeLogMock).toHaveBeenCalledTimes(1);
    const handler = handlers.get('aimp:setLiveStreamStarted');

    const response = await handler?.({}, { liveStreamStarted: true });

    expect(response).toEqual({
      success: false,
      error: 'AIMP live streaming can start only when the selected source is AIMP.',
    });

    unregisterAimpHandlers();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
