import { describe, expect, it, vi } from 'vitest';

import { getLatestDesktopRelease } from './desktopReleaseService';

const makeRelease = (overrides: Record<string, unknown> = {}) => ({
  prerelease: true,
  tag_name: 'player-v0.6.4',
  published_at: '2026-10-01T12:00:00Z',
  assets: [
    {
      name: 'CherryPlayList-0.6.4-x64.zip',
      browser_download_url: 'https://github.com/Urado/CherryPlay/releases/download/player-v0.6.4/CherryPlayList-0.6.4-x64.zip',
    },
  ],
  ...overrides,
});

const createResponse = (data: unknown, ok = true) =>
  ({ ok, json: vi.fn().mockResolvedValue(data) }) as unknown as Response;

describe('getLatestDesktopRelease', () => {
  it('selects the highest matching player tag version', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(
      createResponse([
        makeRelease({ published_at: '2026-09-01T12:00:00Z' }),
        makeRelease({
          tag_name: 'player-v0.7.0',
          published_at: '2026-10-02T12:00:00Z',
          assets: [
            {
              name: 'CherryPlayList-0.7.0-x64.zip',
              browser_download_url: 'https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPlayList-0.7.0-x64.zip',
            },
          ],
        }),
        makeRelease({
          tag_name: 'player-v0.9.0',
          published_at: '2026-09-02T12:00:00Z',
          assets: [
            {
              name: 'CherryPlayList-0.9.0-x64.zip',
              browser_download_url: 'https://github.com/Urado/CherryPlay/releases/download/player-v0.9.0/CherryPlayList-0.9.0-x64.zip',
            },
          ],
        }),
        makeRelease({
          tag_name: 'player-v1.0.0',
          published_at: '2026-10-04T12:00:00Z',
          assets: [
            {
              name: 'CherryPlayList-0.7.1-x64.zip',
              browser_download_url: 'https://github.com/Urado/CherryPlay/releases/download/player-v1.0.0/CherryPlayList-0.7.1-x64.zip',
            },
          ],
        }),
        makeRelease({ tag_name: 'v2.0.0', published_at: '2026-10-03T12:00:00Z' }),
        makeRelease({ prerelease: false, published_at: '2026-10-04T12:00:00Z' }),
      ]),
    );

    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toEqual({
      version: '0.9.0',
      downloadUrl:
        'https://github.com/Urado/CherryPlay/releases/download/player-v0.9.0/CherryPlayList-0.9.0-x64.zip',
    });
  });

  it('reports an HTTP failure', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(createResponse([], false));

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Не удалось получить список релизов GitHub.',
    );
  });

  it('reports a timeout when GitHub does not respond', async () => {
    vi.useFakeTimers();
    const fetchReleases = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    try {
      const result = expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
        'GitHub не ответил вовремя.',
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a timeout when the response body does not finish', async () => {
    vi.useFakeTimers();
    const fetchReleases = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () =>
          new Promise<unknown>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      } as Response),
    );

    try {
      const result = expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
        'GitHub не ответил вовремя.',
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports an invalid response', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(createResponse({ message: 'bad response' }));

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'GitHub вернул некорректный список релизов.',
    );
  });

  it('reports when no matching ZIP exists', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(createResponse([makeRelease({ assets: [] })]));

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });

  it('rejects a prerelease when the ZIP version does not match its player tag', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(
      createResponse([
        makeRelease({
          tag_name: 'player-v1.0.0',
          assets: [
            {
              name: 'CherryPlayList-0.9.9-x64.zip',
              browser_download_url: 'https://github.com/Urado/CherryPlay/releases/download/player-v1.0.0/CherryPlayList-0.9.9-x64.zip',
            },
          ],
        }),
      ]),
    );

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });

  it('rejects player tags with prerelease suffixes', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(
      createResponse([makeRelease({ tag_name: 'player-v1.0.0-beta.1' })]),
    );

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });

  it('rejects download URLs outside GitHub', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(
      createResponse([
        makeRelease({
          assets: [
            {
              name: 'CherryPlayList-0.6.4-x64.zip',
              browser_download_url: 'https://example.com/CherryPlayList-0.6.4-x64.zip',
            },
          ],
        }),
      ]),
    );

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });
});
