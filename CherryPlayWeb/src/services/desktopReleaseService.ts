export interface DesktopRelease {
  version: string;
  downloadUrl: string;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  prerelease: boolean;
  tag_name: string;
  published_at: string | null;
  assets: GitHubAsset[];
}

const RELEASES_URL = 'https://api.github.com/repos/Urado/CherryPlay/releases?per_page=100';
const RELEASES_REQUEST_TIMEOUT_MS = 10_000;
const ZIP_NAME_PATTERN = /^CherryPlayList-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)-x64\.zip$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGitHubAsset = (value: unknown): value is GitHubAsset =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.browser_download_url === 'string';

const isGitHubRelease = (value: unknown): value is GitHubRelease =>
  isRecord(value) &&
  typeof value.prerelease === 'boolean' &&
  typeof value.tag_name === 'string' &&
  (typeof value.published_at === 'string' || value.published_at === null) &&
  Array.isArray(value.assets) &&
  value.assets.every(isGitHubAsset);

const getZipRelease = (release: GitHubRelease): DesktopRelease | null => {
  if (!release.prerelease || !release.tag_name.startsWith('player-') || !release.published_at) {
    return null;
  }

  const asset = release.assets.find((candidate) => ZIP_NAME_PATTERN.test(candidate.name));
  if (!asset || !/^https:\/\/github\.com\//.test(asset.browser_download_url)) {
    return null;
  }

  const match = ZIP_NAME_PATTERN.exec(asset.name);
  if (!match) return null;

  return { version: match[1], downloadUrl: asset.browser_download_url };
};

export const getLatestDesktopRelease = async (
  fetchReleases: typeof fetch = fetch,
): Promise<DesktopRelease> => {
  let data: unknown;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELEASES_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchReleases(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error('Не удалось получить список релизов GitHub. Попробуйте позже.');
    }

    try {
      data = await response.json();
    } catch {
      throw new Error('GitHub вернул некорректный список релизов. Попробуйте позже.');
    }
  } catch (reason: unknown) {
    if (controller.signal.aborted) {
      throw new Error('GitHub не ответил вовремя. Попробуйте позже.');
    }
    if (
      reason instanceof Error &&
      (reason.message.startsWith('Не удалось получить список релизов GitHub.') ||
        reason.message.startsWith('GitHub вернул некорректный список релизов.'))
    ) {
      throw reason;
    }
    throw new Error('Не удалось связаться с GitHub. Проверьте подключение и попробуйте позже.');
  } finally {
    clearTimeout(timeout);
  }
  if (!Array.isArray(data) || !data.every(isGitHubRelease)) {
    throw new Error('GitHub вернул некорректный список релизов. Попробуйте позже.');
  }

  const releases = data
    .map((release) => ({ release, desktopRelease: getZipRelease(release) }))
    .filter(
      (item): item is { release: GitHubRelease; desktopRelease: DesktopRelease } =>
        item.desktopRelease !== null,
    )
    .sort(
      (left, right) =>
        new Date(right.release.published_at ?? 0).getTime() -
        new Date(left.release.published_at ?? 0).getTime(),
    );

  const latestRelease = releases[0]?.desktopRelease;
  if (!latestRelease) {
    throw new Error('Сейчас нет доступной бета-версии приложения. Попробуйте позже.');
  }

  return latestRelease;
};
