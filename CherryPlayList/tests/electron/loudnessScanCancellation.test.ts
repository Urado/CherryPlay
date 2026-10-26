import { EventEmitter } from 'node:events';

type MockChild = EventEmitter & {
  stderr: EventEmitter;
  kill: jest.Mock;
};

const spawnMock = jest.fn<MockChild, unknown[]>();

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => true),
  promises: {
    stat: jest.fn(),
  },
}));

jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

jest.mock('ffmpeg-static', () => ({
  __esModule: true,
  default: 'C:/ffmpeg.exe',
}));

import * as loudnessScanner from '../../electron/audio/loudnessScanner';

type CancellableLoudnessScanner = {
  analyzeLoudness: (
    filePath: string,
    targetLufs: number,
    options: { fileMtime: number; requestId: string },
  ) => Promise<
    { status: 'ok'; integratedLufs: number } | { status: 'error'; errorMessage: string }
  >;
  cancelLoudnessScan: (requestId: string) => boolean | Promise<boolean>;
};

const scanner = loudnessScanner as unknown as CancellableLoudnessScanner;

const ebur128Result = `
Summary:

  Integrated loudness:
    I:         -18.0 LUFS

  True peak:
    Peak:       -2.0 dBTP
`;

const createChild = (killCloses = true): MockChild => {
  const child = new EventEmitter() as MockChild;
  child.stderr = new EventEmitter();
  child.kill = jest.fn(() => {
    if (killCloses) {
      queueMicrotask(() => child.emit('close', null));
    }
    return true;
  });
  return child;
};

const completeChild = (child: MockChild): void => {
  child.stderr.emit('data', ebur128Result);
  child.emit('close', 0);
};

const waitForSpawnCount = async (count: number): Promise<void> => {
  for (let attempt = 0; attempt < 20 && spawnMock.mock.calls.length < count; attempt += 1) {
    await Promise.resolve();
  }
};

describe('loudness scan cancellation by request ID', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  test('kills only the FFmpeg process owned by the cancelled request', async () => {
    expect(scanner.cancelLoudnessScan).toEqual(expect.any(Function));
    const firstChild = createChild();
    const secondChild = createChild(false);
    spawnMock.mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);

    const first = scanner.analyzeLoudness('C:/Music/first.mp3', -18, {
      fileMtime: 1,
      requestId: 'bulk-first',
    });
    await waitForSpawnCount(1);
    const second = scanner.analyzeLoudness('C:/Music/second.mp3', -18, {
      fileMtime: 2,
      requestId: 'session-second',
    });

    await expect(Promise.resolve(scanner.cancelLoudnessScan('bulk-first'))).resolves.toBe(true);
    await expect(first).resolves.toMatchObject({ status: 'error' });
    await waitForSpawnCount(2);
    completeChild(secondChild);

    await expect(second).resolves.toMatchObject({ status: 'ok', integratedLufs: -18 });
    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(secondChild.kill).not.toHaveBeenCalled();
  });

  test('removes a queued request without starting its FFmpeg process', async () => {
    expect(scanner.cancelLoudnessScan).toEqual(expect.any(Function));
    const activeChild = createChild(false);
    spawnMock.mockReturnValueOnce(activeChild);

    const active = scanner.analyzeLoudness('C:/Music/active.mp3', -18, {
      fileMtime: 1,
      requestId: 'active',
    });
    await waitForSpawnCount(1);
    const queued = scanner.analyzeLoudness('C:/Music/queued.mp3', -18, {
      fileMtime: 2,
      requestId: 'queued',
    });

    await expect(Promise.resolve(scanner.cancelLoudnessScan('queued'))).resolves.toBe(true);
    completeChild(activeChild);

    await expect(active).resolves.toMatchObject({ status: 'ok' });
    await expect(queued).resolves.toMatchObject({ status: 'error' });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(activeChild.kill).not.toHaveBeenCalled();
  });

  test('keeps cancellation idempotent and ignores a late successful close event', async () => {
    expect(scanner.cancelLoudnessScan).toEqual(expect.any(Function));
    const child = createChild(false);
    spawnMock.mockReturnValue(child);

    const scan = scanner.analyzeLoudness('C:/Music/late.mp3', -18, {
      fileMtime: 1,
      requestId: 'late-result',
    });
    await waitForSpawnCount(1);

    await expect(Promise.resolve(scanner.cancelLoudnessScan('late-result'))).resolves.toBe(true);
    await expect(Promise.resolve(scanner.cancelLoudnessScan('late-result'))).resolves.toBe(true);
    child.stderr.emit('data', ebur128Result);
    child.emit('close', 0);

    await expect(scan).resolves.toMatchObject({ status: 'error' });
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  test('preserves a successful scan that settled before cancellation', async () => {
    expect(scanner.cancelLoudnessScan).toEqual(expect.any(Function));
    const child = createChild(false);
    spawnMock.mockReturnValue(child);

    const scan = scanner.analyzeLoudness('C:/Music/completed.mp3', -18, {
      fileMtime: 1,
      requestId: 'completed-before-cancel',
    });
    await waitForSpawnCount(1);
    completeChild(child);

    await expect(scan).resolves.toMatchObject({ status: 'ok', integratedLufs: -18 });
    await expect(
      Promise.resolve(scanner.cancelLoudnessScan('completed-before-cancel')),
    ).resolves.toBe(false);
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('does not cancel an unrelated request when the request ID is unknown', async () => {
    expect(scanner.cancelLoudnessScan).toEqual(expect.any(Function));
    const child = createChild(false);
    spawnMock.mockReturnValue(child);

    const scan = scanner.analyzeLoudness('C:/Music/owned.mp3', -18, {
      fileMtime: 1,
      requestId: 'owned',
    });
    await waitForSpawnCount(1);

    await expect(Promise.resolve(scanner.cancelLoudnessScan('missing'))).resolves.toBe(false);
    completeChild(child);

    await expect(scan).resolves.toMatchObject({ status: 'ok' });
    expect(child.kill).not.toHaveBeenCalled();
  });
});
