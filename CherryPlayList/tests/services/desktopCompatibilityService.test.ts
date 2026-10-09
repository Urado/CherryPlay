import {
  checkDesktopCompatibility,
  isDesktopCompatibilityAffected,
} from '../../src/shared/services/desktopCompatibilityService';

describe('desktop compatibility policy', () => {
  it.each([
    ['0.6.99', '0.7.0', true],
    ['0.7.0-beta.1', '0.7.99', false],
    ['0.7.1', '0.7.0', false],
    ['1.0.0', '0.99.0', false],
    ['0.99.0', '1.0.0', true],
    ['broken', '1.0.0', false],
    ['0.6.0', '1.0.2147483648', false],
  ])('compares %s to %s by major/minor', (current, minimum, affected) => {
    expect(isDesktopCompatibilityAffected(current, minimum)).toBe(affected);
  });

  it.each([null, [], 'config'])('rejects non-object config payloads %j', async (data) => {
    const fetchConfig = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
    expect(
      await checkDesktopCompatibility(
        'https://server.test',
        new AbortController().signal,
        fetchConfig,
      ),
    ).toEqual({ success: false });
  });

  it.each([
    {},
    { desktopCompatibilityWarning: {} },
    { desktopCompatibilityWarning: { minVersion: 'x', serverVersion: '0.8.0' } },
    { desktopCompatibilityWarning: { minVersion: '0.8.0', serverVersion: '<script>' } },
    { desktopCompatibilityWarning: { minVersion: '0.8', serverVersion: '0.9.0' } },
    { desktopCompatibilityWarning: { minVersion: '0.8.0-beta', serverVersion: '0.9.0' } },
    { desktopCompatibilityWarning: { minVersion: '0.8.0', serverVersion: '0.9.2147483648' } },
  ])('ignores malformed warning without failing the config %j', async (data) => {
    const fetchConfig = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
    expect(
      await checkDesktopCompatibility(
        'https://server.test',
        new AbortController().signal,
        fetchConfig,
      ),
    ).toEqual({ success: true, warning: null, updateVersion: null });
  });

  it.each([null, { minVersion: '0.8.0', serverVersion: '0.9.0' }])(
    'accepts explicit policy %j without credentials',
    async (warning) => {
      const fetchConfig = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ desktopCompatibilityWarning: warning }),
      });
      expect(
        await checkDesktopCompatibility(
          'https://server.test/',
          new AbortController().signal,
          fetchConfig,
        ),
      ).toEqual({ success: true, warning, updateVersion: null });
      expect(fetchConfig).toHaveBeenCalledWith(
        'https://server.test/api/config',
        expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
      );
    },
  );

  it('accepts a valid server-announced release version', async () => {
    const fetchConfig = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          desktopCompatibilityWarning: null,
          desktopUpdateVersion: '0.8.0-beta.2',
        }),
    });
    await expect(
      checkDesktopCompatibility('https://server.test', new AbortController().signal, fetchConfig),
    ).resolves.toEqual({ success: true, warning: null, updateVersion: '0.8.0-beta.2' });
  });

  it('keeps a valid updateVersion when the warning is malformed', async () => {
    const fetchConfig = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          desktopCompatibilityWarning: { minVersion: 'x', serverVersion: '0.8.0' },
          desktopUpdateVersion: '0.8.0-beta.2',
        }),
    });
    await expect(
      checkDesktopCompatibility('https://server.test', new AbortController().signal, fetchConfig),
    ).resolves.toEqual({ success: true, warning: null, updateVersion: '0.8.0-beta.2' });
  });

  it.each([42, true, {}, [], null])(
    'drops invalid desktopUpdateVersion %j while keeping a valid warning',
    async (desktopUpdateVersion) => {
      const warning = { minVersion: '0.8.0', serverVersion: '0.9.0' };
      const fetchConfig = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ desktopCompatibilityWarning: warning, desktopUpdateVersion }),
      });
      await expect(
        checkDesktopCompatibility('https://server.test', new AbortController().signal, fetchConfig),
      ).resolves.toEqual({ success: true, warning, updateVersion: null });
    },
  );

  it('handles HTTP and network errors', async () => {
    const fetchConfig = jest
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('offline'));
    expect(
      await checkDesktopCompatibility(
        'https://server.test',
        new AbortController().signal,
        fetchConfig,
      ),
    ).toEqual({ success: false });
    expect(
      await checkDesktopCompatibility(
        'https://server.test',
        new AbortController().signal,
        fetchConfig,
      ),
    ).toEqual({ success: false });
  });

  it('aborts timed out requests', async () => {
    jest.useFakeTimers();
    try {
      const fetchConfig = jest.fn(
        (_url: RequestInfo | URL, options?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const result = checkDesktopCompatibility(
        'https://server.test',
        new AbortController().signal,
        fetchConfig,
      );
      await jest.advanceTimersByTimeAsync(10_000);
      expect(await result).toEqual({ success: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not fetch after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchConfig = jest.fn();
    expect(
      await checkDesktopCompatibility('https://server.test', controller.signal, fetchConfig),
    ).toEqual({ success: false });
    expect(fetchConfig).not.toHaveBeenCalled();
  });
});
