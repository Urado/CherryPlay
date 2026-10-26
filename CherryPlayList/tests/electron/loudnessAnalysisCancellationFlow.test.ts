const handlers = new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>();
const handleMock = jest.fn(
  (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
    handlers.set(channel, handler);
  },
);
const statMock = jest.fn();
const analyzeLoudnessMock = jest.fn();
const cancelLoudnessScanMock = jest.fn();

jest.mock('electron', () => ({
  ipcMain: { handle: handleMock },
}));

jest.mock('fs/promises', () => ({
  stat: statMock,
}));

jest.mock('../../electron/audio/loudnessScanner', () => ({
  analyzeLoudness: analyzeLoudnessMock,
  cancelLoudnessScan: cancelLoudnessScanMock,
  DEFAULT_TARGET_LUFS: -18,
  MAX_TARGET_LUFS: 0,
  MIN_TARGET_LUFS: -70,
}));

import { registerAudioHandlers } from '../../electron/ipc/audio';
import type { Track } from '../../src/core/types/track';
import type { LoudnessSettings } from '../../src/shared/contracts/loudness';
import { resetPlatformForTests, setPlatform } from '../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../src/shared/platform/types';
import { ipcService } from '../../src/shared/services/ipcService';
import { createLoudnessService } from '../../src/shared/services/loudnessService';

const enabledSettings: LoudnessSettings = {
  loudnessNormalizationEnabled: true,
  loudnessTargetLufs: -18,
  loudnessCompressionEnabled: false,
  loudnessQuietGapRangeLu: 15,
};

const createDeferred = <T,>() => {
  let resolve = (_value: T): void => {};
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createTrack = (id: string): Track => ({
  id,
  path: `C:\\Music\\${id}.mp3`,
  name: id,
});

describe('loudness analysis cancellation request flow', () => {
  beforeEach(() => {
    handlers.clear();
    handleMock.mockClear();
    statMock.mockReset();
    analyzeLoudnessMock.mockReset();
    cancelLoudnessScanMock.mockReset();
    statMock.mockResolvedValue({
      isFile: () => true,
      mtimeMs: 1000,
      size: 1024,
    });
    cancelLoudnessScanMock.mockReturnValue(true);

    const api: PlatformAPI = {
      getPathForFile: () => '',
      invoke: async (channel, payload) => {
        const handler = handlers.get(channel);
        if (!handler) throw new Error(`Missing IPC handler: ${channel}`);
        return (await handler({}, payload)) as never;
      },
      on: () => () => undefined,
      aimp: {
        getState: () => Promise.resolve({ success: false }),
        setSourceSelection: () => Promise.resolve({ success: false }),
        setLiveStreamStarted: () => Promise.resolve({ success: false }),
        onStateChanged: () => () => undefined,
        onLog: () => () => undefined,
      },
    };

    setPlatform(api, 'electron');
    registerAudioHandlers();
  });

  afterEach(() => {
    resetPlatformForTests();
  });

  test('passes the generated request ID through IPC and cancels that scanner request', async () => {
    const analysis = createDeferred<{
      status: 'ok';
      integratedLufs: number;
      truePeakDb: number;
      trackGainDb: number;
    }>();
    const analysisStarted = createDeferred<void>();
    analyzeLoudnessMock.mockImplementation(() => {
      analysisStarted.resolve();
      return analysis.promise;
    });

    let projectScope = 'project-a';
    const service = createLoudnessService({
      getSettings: () => enabledSettings,
      getScopeKey: () => projectScope,
      updateTrackLoudness: jest.fn(),
      analyzeLoudness: (path, targetLufs, requestId) =>
        ipcService.analyzeLoudness(path, targetLufs, false, requestId),
      cancelLoudnessScan: (requestId) => ipcService.cancelLoudnessScan(requestId),
      statAudioFile: async (path) => ipcService.statAudioFile(path, false),
      canAnalyze: () => true,
    });

    const firstScan = service.scanTrack(createTrack('first'));
    await analysisStarted.promise;

    expect(analyzeLoudnessMock).toHaveBeenCalledTimes(1);

    const [analyzedPath, targetLufs, options] = analyzeLoudnessMock.mock.calls[0] as [
      string,
      number,
      { requestId?: string },
    ];
    const requestId = options.requestId;

    expect(analyzedPath).toBe('C:\\Music\\first.mp3');
    expect(targetLufs).toBe(-18);
    expect(requestId).toEqual(expect.any(String));
    expect(requestId).toMatch(/^loudness-1-first$/);

    projectScope = 'project-b';
    analyzeLoudnessMock.mockResolvedValue({
      status: 'ok',
      integratedLufs: -19,
      truePeakDb: -2,
      trackGainDb: 1,
    });
    await service.scanTrack(createTrack('second'));

    expect(cancelLoudnessScanMock).toHaveBeenCalledTimes(1);
    expect(cancelLoudnessScanMock).toHaveBeenCalledWith(requestId);

    analysis.resolve({
      status: 'ok',
      integratedLufs: -20,
      truePeakDb: -3,
      trackGainDb: 2,
    });
    await firstScan;
  });
});
