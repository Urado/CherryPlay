const mockHandlers = new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>();
const mockIpcMainHandle = jest.fn(
  (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
    mockHandlers.set(channel, handler);
  },
);
const mockExposeInMainWorld = jest.fn();
const mockInvoke = jest.fn();
const mockOn = jest.fn();
const mockRemoveListener = jest.fn();
const mockCancelLoudnessScan = jest.fn();
const mockAnalyzeLoudness = jest.fn();

jest.mock('electron', () => ({
  ipcMain: { handle: mockIpcMainHandle },
  contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
  webUtils: { getPathForFile: jest.fn() },
}));

jest.mock('fs/promises', () => ({
  stat: jest.fn(),
  access: jest.fn(),
}));

jest.mock('music-metadata', () => ({ parseFile: jest.fn() }));

jest.mock('../../electron/audio/loudnessScanner', () => ({
  analyzeLoudness: mockAnalyzeLoudness,
  cancelLoudnessScan: mockCancelLoudnessScan,
  DEFAULT_TARGET_LUFS: -18,
  MAX_TARGET_LUFS: 0,
  MIN_TARGET_LUFS: -70,
}));

import { registerAudioHandlers } from '../../electron/ipc/audio';

const loadExposedApi = async (): Promise<{
  invoke: (channel: string, payload?: object) => Promise<unknown>;
}> => {
  await import('../../electron/preload');
  const exposedCall = mockExposeInMainWorld.mock.calls[0] as [string, unknown] | undefined;
  return exposedCall?.[1] as {
    invoke: (channel: string, payload?: object) => Promise<unknown>;
  };
};

describe('loudness cancellation IPC contract', () => {
  beforeEach(() => {
    mockHandlers.clear();
    mockIpcMainHandle.mockClear();
    mockExposeInMainWorld.mockClear();
    mockInvoke.mockReset();
    mockCancelLoudnessScan.mockReset();
    registerAudioHandlers();
  });

  test('cancels a scan only for a valid request ID', async () => {
    mockCancelLoudnessScan.mockResolvedValue(true);
    const handler = mockHandlers.get('audio:cancelLoudnessScan');

    expect(handler).toEqual(expect.any(Function));

    const response = await handler?.({}, { requestId: 'bulk-request-4' });

    expect(mockCancelLoudnessScan).toHaveBeenCalledWith('bulk-request-4');
    expect(response).toEqual(expect.objectContaining({ success: true }));
  });

  test('rejects malformed cancellation IDs without reaching the scanner', async () => {
    const handler = mockHandlers.get('audio:cancelLoudnessScan');

    expect(handler).toEqual(expect.any(Function));

    const response = await handler?.({}, { requestId: { id: 'wrong-shape' } });

    expect(mockCancelLoudnessScan).not.toHaveBeenCalled();
    expect(response).toEqual(expect.objectContaining({ success: false }));
  });

  test('rejects an empty cancellation ID without reaching the scanner', async () => {
    const handler = mockHandlers.get('audio:cancelLoudnessScan');

    expect(handler).toEqual(expect.any(Function));

    const response = await handler?.({}, { requestId: '' });

    expect(mockCancelLoudnessScan).not.toHaveBeenCalled();
    expect(response).toEqual(expect.objectContaining({ success: false }));
  });

  test('rejects cancellation IDs longer than 256 characters', async () => {
    const handler = mockHandlers.get('audio:cancelLoudnessScan');

    expect(handler).toEqual(expect.any(Function));

    const response = await handler?.({}, { requestId: 'x'.repeat(257) });

    expect(mockCancelLoudnessScan).not.toHaveBeenCalled();
    expect(response).toEqual(expect.objectContaining({ success: false }));
  });

  test('allows only the cancellation channel through the renderer IPC bridge', async () => {
    const api = await loadExposedApi();
    mockInvoke.mockResolvedValue({ success: true });

    await api.invoke('audio:cancelLoudnessScan', { requestId: 'bulk-request-5' });

    expect(mockInvoke).toHaveBeenCalledWith('audio:cancelLoudnessScan', {
      requestId: 'bulk-request-5',
    });
    expect(() => api.invoke('audio:cancelEveryProcess')).toThrow(
      'Invalid IPC channel: audio:cancelEveryProcess',
    );
  });
});
