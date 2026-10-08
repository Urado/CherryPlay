import { describe, expect, it, vi } from 'vitest';

import { getLatestDesktopRelease } from './desktopReleaseService';

const createRelease = (version: string) => ({
  prerelease: true,
  tag_name: `player-v${version}`,
  assets: [
    {
      name: `CherryPashkaList-${version}-x64.zip`,
      browser_download_url: `https://github.com/Urado/CherryPlay/releases/download/player-v${version}/CherryPashkaList-${version}-x64.zip`,
    },
  ],
});

const createResponse = (data: unknown) =>
  ({ ok: true, json: vi.fn().mockResolvedValue(data) }) as unknown as Response;

describe('getLatestDesktopRelease strict version selection', () => {
  it('checks later release pages before selecting the highest version', async () => {
    const firstPage = Array.from({ length: 100 }, () => createRelease('0.6.4'));
    const fetchReleases = vi
      .fn()
      .mockResolvedValueOnce(createResponse(firstPage))
      .mockResolvedValueOnce(createResponse([createRelease('0.9.0')]));

    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toMatchObject({ version: '0.9.0' });
    expect(fetchReleases).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchReleases.mock.calls[0][0])).searchParams.get('page')).toBe('1');
    expect(new URL(String(fetchReleases.mock.calls[1][0])).searchParams.get('page')).toBe('2');
  });

  it.each(['01.2.3', '1.02.3', '1.2.03', '1.2.3-beta.1'])(
    'rejects non-strict tag version %s',
    async (version) => {
      const fetchReleases = vi.fn().mockResolvedValue(createResponse([createRelease(version)]));

      await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
        'Сейчас нет доступной бета-версии приложения.',
      );
    },
  );

  it('orders numeric components larger than JavaScript safe integers precisely', async () => {
    const fetchReleases = vi.fn().mockResolvedValue(
      createResponse([createRelease('9007199254740993.0.0'), createRelease('9007199254740992.9.9')]),
    );

    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toMatchObject({
      version: '9007199254740993.0.0',
    });
  });

  it('rejects GitHub lookalike hosts and non-HTTPS URLs', async () => {
    const release = createRelease('1.2.3');
    release.assets[0].browser_download_url =
      'https://github.com.attacker.example/Urado/CherryPlay/releases/download/player-v1.2.3/CherryPashkaList-1.2.3-x64.zip';
    const fetchReleases = vi.fn().mockResolvedValue(createResponse([release]));

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });

  it.each([
    'https://github.com/attacker/CherryPlay/releases/download/player-v1.2.3/CherryPashkaList-1.2.3-x64.zip',
    'https://github.com/Urado/OtherProject/releases/download/player-v1.2.3/CherryPashkaList-1.2.3-x64.zip',
    'https://github.com/Urado/CherryPlay/releases/download/player-v1.2.3/other.zip',
  ])('rejects GitHub asset URLs outside the expected repository path: %s', async (url) => {
    const release = createRelease('1.2.3');
    release.assets[0].browser_download_url = url;
    const fetchReleases = vi.fn().mockResolvedValue(createResponse([release]));

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });
});
