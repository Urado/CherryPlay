import {
  checkLatestDesktopUpdate,
  compareDesktopVersions,
  getDesktopDownloadPageUrl,
  getLatestDesktopUpdate,
} from '../src/shared/services/desktopUpdateService';

const buildRelease = (
  tagName: string,
  options?: {
    prerelease?: boolean;
    assetVersion?: string;
    assetName?: string;
    downloadUrl?: string;
  },
) => {
  const assetName =
    options?.assetName ??
    `CherryPashkaParty-${options?.assetVersion ?? tagName.replace(/^player-v/, '')}-x64.zip`;
  return {
    prerelease: options?.prerelease ?? true,
    tag_name: tagName,
    assets: [
      {
        name: assetName,
        browser_download_url:
          options?.downloadUrl ??
          `https://github.com/Urado/CherryPlay/releases/download/${tagName}/${assetName}`,
      },
    ],
  };
};

const buildResponse = (ok: boolean, body: unknown): Response =>
  ({ ok, json: () => Promise.resolve(body) }) as Response;

describe('desktopUpdateService', () => {
  it('uses a trusted List archive when an earlier Party archive URL is invalid', async () => {
    const release = buildRelease('player-v0.7.0', {
      downloadUrl: 'https://attacker.example/file.zip',
    });
    release.assets.push(
      ...buildRelease('player-v0.7.0', { assetName: 'CherryPashkaList-0.7.0-x64.zip' }).assets,
    );
    const fetchReleases = jest.fn().mockResolvedValue(buildResponse(true, [release]));
    await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toEqual({ version: '0.7.0' });
  });
  it('accepts the published List archive and picks the highest version across both archive names', async () => {
    const fetchReleases = jest
      .fn()
      .mockResolvedValue(
        buildResponse(true, [
          buildRelease('player-v0.6.4'),
          buildRelease('player-v0.7.0', { assetName: 'CherryPashkaList-0.7.0-x64.zip' }),
          buildRelease('player-v0.8.0', { assetName: 'CherryPashkaList-0.7.0-x64.zip' }),
        ]),
      );
    await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toEqual({ version: '0.7.0' });
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
      const fetchReleases = jest.fn().mockResolvedValue(
        buildResponse(true, [
          buildRelease('player-v0.7.0', {
            assetName: 'CherryPashkaList-0.7.0-x64.zip',
            downloadUrl,
          }),
        ]),
      );
      await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toBeNull();
    },
  );
  it('compares stable and prerelease semantic versions', () => {
    expect(compareDesktopVersions('0.7.0', '0.6.9')).toBe(1);
    expect(compareDesktopVersions('1.0.0-alpha.2', '1.0.0-alpha.10')).toBe(-1);
    expect(compareDesktopVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareDesktopVersions('invalid', '1.0.0')).toBeNull();
  });

  it('uses the highest matching player release tag as the version', async () => {
    const fetchReleases = jest
      .fn()
      .mockResolvedValue(
        buildResponse(true, [
          buildRelease('player-v0.8.0'),
          buildRelease('player-v0.9.0'),
          buildRelease('player-v9.0.0', { prerelease: false }),
          buildRelease('player-v10.0.0', { assetVersion: '9.9.9' }),
        ]),
      );

    await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toEqual({
      version: '0.9.0',
    });
  });

  it('rejects a release with the old technical archive name', async () => {
    const fetchReleases = jest
      .fn()
      .mockResolvedValue(
        buildResponse(true, [
          buildRelease('player-v0.8.0', { assetName: 'CherryPlayList-0.8.0-x64.zip' }),
        ]),
      );

    await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toBeNull();
  });

  it('checks later GitHub pages before choosing the highest matching release', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => buildRelease(`web-v${index}.0.0`));
    const fetchReleases = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValueOnce(buildResponse(true, firstPage))
      .mockResolvedValueOnce(buildResponse(true, [buildRelease('player-v1.0.0')]));

    await expect(checkLatestDesktopUpdate(fetchReleases)).resolves.toEqual({
      success: true,
      update: { version: '1.0.0' },
    });
    expect(fetchReleases.mock.calls[0][0]).toContain('per_page=100&page=1');
    expect(fetchReleases.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchReleases.mock.calls[1][0]).toContain('per_page=100&page=2');
    expect(fetchReleases.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('traverses more than ten full pages before selecting the highest release', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => buildRelease(`web-v${index}.0.0`));
    const fetchReleases = jest.fn().mockImplementation((url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      return Promise.resolve(
        buildResponse(true, page <= 11 ? fullPage : [buildRelease('player-v5.0.0')]),
      );
    });

    await expect(checkLatestDesktopUpdate(fetchReleases)).resolves.toEqual({
      success: true,
      update: { version: '5.0.0' },
    });
    expect(fetchReleases).toHaveBeenCalledTimes(12);
  });

  it('rejects player tags with prerelease suffixes', async () => {
    const fetchReleases = jest
      .fn()
      .mockResolvedValue(buildResponse(true, [buildRelease('player-v1.0.0-beta.1')]));

    await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toBeNull();
  });

  it('rejects player tags with leading zeroes and untrusted asset URLs', async () => {
    const fetchReleases = jest.fn().mockResolvedValue(
      buildResponse(true, [
        buildRelease('player-v01.0.0'),
        buildRelease('player-v2.0.0', {
          downloadUrl: 'https://github.com.attacker.test/file.zip',
        }),
      ]),
    );

    await expect(getLatestDesktopUpdate(fetchReleases)).resolves.toBeNull();
  });

  it('compares large numeric identifiers without precision loss', () => {
    expect(compareDesktopVersions('9007199254740993.0.0', '9007199254740992.0.0')).toBe(1);
    expect(
      compareDesktopVersions('1.0.0-alpha.9007199254740993', '1.0.0-alpha.9007199254740992'),
    ).toBe(1);
  });

  it('distinguishes a successful empty result from a transient request failure', async () => {
    await expect(
      checkLatestDesktopUpdate(jest.fn().mockResolvedValue(buildResponse(true, []))),
    ).resolves.toEqual({ success: true, update: null });
    await expect(
      checkLatestDesktopUpdate(jest.fn().mockRejectedValue(new Error('offline'))),
    ).resolves.toEqual({ success: false });
  });

  it('returns no update when GitHub is unavailable, fails, or has no matching release', async () => {
    await expect(
      getLatestDesktopUpdate(jest.fn().mockResolvedValue(buildResponse(false, []))),
    ).resolves.toBeNull();
    await expect(
      getLatestDesktopUpdate(jest.fn().mockRejectedValue(new Error('offline'))),
    ).resolves.toBeNull();
    await expect(
      getLatestDesktopUpdate(
        jest
          .fn()
          .mockResolvedValue(
            buildResponse(true, [buildRelease('player-v1.0.0', { prerelease: false })]),
          ),
      ),
    ).resolves.toBeNull();
  });

  it('creates an absolute download page URL', () => {
    expect(getDesktopDownloadPageUrl('https://example.test/base')).toBe(
      'https://example.test/download',
    );
  });
});
