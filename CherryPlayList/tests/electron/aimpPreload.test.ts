import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';

const exposeInMainWorldMock = jest.fn();
const invokeMock = jest.fn();
const removeListenerMock = jest.fn();
const channelListeners = new Map<string, Set<(...args: unknown[]) => void>>();

const onMock = jest.fn((channel: string, listener: (...args: unknown[]) => void) => {
  const listeners = channelListeners.get(channel) ?? new Set<(...args: unknown[]) => void>();
  listeners.add(listener);
  channelListeners.set(channel, listeners);
});

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock,
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock.mockImplementation(
      (channel: string, listener: (...args: unknown[]) => void) => {
        channelListeners.get(channel)?.delete(listener);
      },
    ),
  },
}));

import '../../electron/preload';

function emitChannel(channel: string, payload: unknown): void {
  for (const listener of channelListeners.get(channel) ?? []) {
    listener({} as Electron.IpcRendererEvent, payload);
  }
}

describe('AIMP preload bridge', () => {
  const exposedApi = exposeInMainWorldMock.mock.calls[0][1] as Window['api'];

  beforeEach(() => {
    invokeMock.mockReset();
    onMock.mockClear();
    removeListenerMock.mockClear();
    channelListeners.clear();
  });

  test('rejects invalid nested bridge states returned from invoke responses', async () => {
    const state = createInitialAimpBridgeState();
    invokeMock.mockResolvedValue({
      success: true,
      data: {
        ...state,
        compatibilityCheckpointInput: {
          ...state.compatibilityCheckpointInput,
          liveStreamStarted: true,
        },
      },
    });

    await expect(exposedApi.aimp.getState()).rejects.toThrow(
      'AIMP compatibilityCheckpointInput liveStreamStarted must match bridge state liveStreamStarted',
    );
  });

  test('unsubscribes from AIMP state events cleanly', () => {
    const state = createInitialAimpBridgeState();
    const listener = jest.fn();

    const unsubscribe = exposedApi.aimp.onStateChanged(listener);
    emitChannel('aimp:state-changed', state);
    unsubscribe();
    emitChannel('aimp:state-changed', state);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(removeListenerMock).toHaveBeenCalledWith('aimp:state-changed', expect.any(Function));
  });

  test('throws when an AIMP state event payload violates the preload bridge contract', () => {
    const state = createInitialAimpBridgeState();
    const listener = jest.fn();

    exposedApi.aimp.onStateChanged(listener);

    expect(() =>
      emitChannel('aimp:state-changed', {
        ...state,
        environment: {
          ...state.environment,
          gatingReasons: [
            {
              code: 'sourceNotAimp',
              message: 99,
            },
          ],
        },
      }),
    ).toThrow('AIMP environment gatingReason at index 0 message is required');
    expect(listener).not.toHaveBeenCalled();
  });
});
