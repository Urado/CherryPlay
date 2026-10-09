import { describe, expect, it, vi } from 'vitest';

import { getLatestDesktopRelease } from './desktopReleaseService';

const createRelease = (version: string, archiveName = 'CherryPashkaParty') => ({
  prerelease: true,
  tag_name: `player-v${version}`,
  assets: [
    {
      name: `${archiveName}-${version}-x64.zip`,
      browser_download_url: `https://github.com/Urado/CherryPlay/releases/download/player-v${version}/${archiveName}-${version}-x64.zip`,
    },
  ],
});

const createResponse = (data: unknown) =>
  ({ ok: true, json: vi.fn().mockResolvedValue(data) }) as unknown as Response;

describe('getLatestDesktopRelease strict version selection', () => {
  it('uses a trusted List archive when an earlier Party archive URL is invalid', async () => {
    const release = createRelease('0.7.0');
    release.assets[0].browser_download_url = 'https://attacker.example/file.zip';
    release.assets.push(...createRelease('0.7.0', 'CherryPashkaList').assets);
    const fetchReleases = vi.fn().mockResolvedValue(createResponse([release]));
    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toMatchObject({
      version: '0.7.0',
    });
  });
  it('accepts the published List archive and picks the highest version across both archive names', async () => {
    const mismatchedRelease = createRelease('0.7.0', 'CherryPashkaList');
    mismatchedRelease.tag_name = 'player-v0.8.0';
    const fetchReleases = vi
      .fn()
      .mockResolvedValue(
        createResponse([
          createRelease('0.6.4'),
          createRelease('0.7.0', 'CherryPashkaList'),
          mismatchedRelease,
        ]),
      );
    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toEqual({
      version: '0.7.0',
      downloadUrl:
        'https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaList-0.7.0-x64.zip',
    });
  });

  it.each([
    'https://github.com/attacker/CherryPlay/releases/download/player-v0.7.0/CherryPashkaList-0.7.0-x64.zip',
    'https://github.com/Urado/CherryPlay/releases/download/player-v0.6.4/CherryPashkaList-0.7.0-x64.zip',
    'https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip',
    'https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaList-0.7.0-x64.zip?download=1',
    'https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaList-0.7.0-x64.zip#asset',
    'https://github.com:8443/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaList-0.7.0-x64.zip',
    'https://user@github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaList-0.7.0-x64.zip',
  ])(
    'rejects List archive URLs that do not match their trusted release path: %s',
    async (downloadUrl) => {
      const release = createRelease('0.7.0', 'CherryPashkaList');
      release.assets[0].browser_download_url = downloadUrl;
      const fetchReleases = vi.fn().mockResolvedValue(createResponse([release]));
      await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
        'Сейчас нет доступной бета-версии приложения.',
      );
    },
  );
  it('checks later release pages before selecting the highest version', async () => {
    const firstPage = Array.from({ length: 100 }, () => createRelease('0.6.4'));
    const fetchReleases = vi
      .fn()
      .mockResolvedValueOnce(createResponse(firstPage))
      .mockResolvedValueOnce(createResponse([createRelease('0.9.0')]));

    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toMatchObject({
      version: '0.9.0',
    });
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
    const fetchReleases = vi
      .fn()
      .mockResolvedValue(
        createResponse([
          createRelease('9007199254740993.0.0'),
          createRelease('9007199254740992.9.9'),
        ]),
      );

    await expect(getLatestDesktopRelease(fetchReleases)).resolves.toMatchObject({
      version: '9007199254740993.0.0',
    });
  });

  it('rejects GitHub lookalike hosts and non-HTTPS URLs', async () => {
    const release = createRelease('1.2.3');
    release.assets[0].browser_download_url =
      'https://github.com.attacker.example/Urado/CherryPlay/releases/download/player-v1.2.3/CherryPashkaParty-1.2.3-x64.zip';
    const fetchReleases = vi.fn().mockResolvedValue(createResponse([release]));

    await expect(getLatestDesktopRelease(fetchReleases)).rejects.toThrow(
      'Сейчас нет доступной бета-версии приложения.',
    );
  });

  it.each([
    'https://github.com/attacker/CherryPlay/releases/download/player-v1.2.3/CherryPashkaParty-1.2.3-x64.zip',
    'https://github.com/Urado/OtherProject/releases/download/player-v1.2.3/CherryPashkaParty-1.2.3-x64.zip',
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
