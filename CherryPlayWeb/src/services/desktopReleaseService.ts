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
  assets: GitHubAsset[];
}

const RELEASES_URL = 'https://api.github.com/repos/Urado/CherryPlay/releases?per_page=100';
const RELEASES_PER_PAGE = 100;
const RELEASES_REQUEST_TIMEOUT_MS = 10_000;
const TAG_PATTERN = /^player-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

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
  Array.isArray(value.assets) &&
  value.assets.every(isGitHubAsset);

const parseVersion = (version: string): { core: string[]; prerelease: string[] } | null => {
  const match = VERSION_PATTERN.exec(version);
  if (!match) return null;
  return {
    core: [match[1], match[2], match[3]],
    prerelease: match[4] ? match[4].split('.') : [],
  };
};

const compareNumericIdentifiers = (left: string, right: string): number => {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
};

const comparePrerelease = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return compareNumericIdentifiers(leftPart, rightPart);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
};

const compareVersions = (left: string, right: string): number | null => {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return null;
  for (let index = 0; index < 3; index += 1) {
    if (leftVersion.core[index] !== rightVersion.core[index]) {
      return compareNumericIdentifiers(leftVersion.core[index], rightVersion.core[index]);
    }
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
};

const getZipRelease = (release: GitHubRelease): DesktopRelease | null => {
  if (!release.prerelease) {
    return null;
  }

  const tagMatch = TAG_PATTERN.exec(release.tag_name);
  if (!tagMatch) return null;
  const version = `${tagMatch[1]}.${tagMatch[2]}.${tagMatch[3]}`;
  const zipNames = [`CherryPashkaList-${version}-x64.zip`, `CherryPlayList-${version}-x64.zip`];
  const asset = release.assets.find((candidate) => zipNames.includes(candidate.name));
  let downloadUrl: URL;
  try {
    downloadUrl = new URL(asset?.browser_download_url ?? '');
  } catch {
    return null;
  }
  if (
    !asset ||
    downloadUrl.protocol !== 'https:' ||
    downloadUrl.hostname !== 'github.com' ||
    downloadUrl.username !== '' ||
    downloadUrl.password !== '' ||
    downloadUrl.port !== '' ||
    downloadUrl.pathname !==
      `/Urado/CherryPlay/releases/download/player-v${version}/${asset?.name}` ||
    downloadUrl.search !== '' ||
    downloadUrl.hash !== ''
  ) {
    return null;
  }

  return { version, downloadUrl: asset.browser_download_url };
};

export const getLatestDesktopRelease = async (
  fetchReleases: typeof fetch = fetch,
): Promise<DesktopRelease> => {
  const data: GitHubRelease[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELEASES_REQUEST_TIMEOUT_MS);
  try {
    for (let page = 1; ; page += 1) {
      const pageUrl = new URL(RELEASES_URL);
      pageUrl.searchParams.set('page', String(page));
      const response = await fetchReleases(pageUrl, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('Не удалось получить список релизов GitHub. Попробуйте позже.');
      }

      let pageData: unknown;
      try {
        pageData = await response.json();
      } catch {
        throw new Error('GitHub вернул некорректный список релизов. Попробуйте позже.');
      }
      if (!Array.isArray(pageData) || !pageData.every(isGitHubRelease)) {
        throw new Error('GitHub вернул некорректный список релизов. Попробуйте позже.');
      }

      data.push(...pageData);
      if (pageData.length < RELEASES_PER_PAGE) break;
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

  const releases = data
    .map(getZipRelease)
    .filter((release): release is DesktopRelease => release !== null)
    .sort((left, right) => compareVersions(right.version, left.version) ?? 0);

  const latestRelease = releases[0];
  if (!latestRelease) {
    throw new Error('Сейчас нет доступной бета-версии приложения. Попробуйте позже.');
  }

  return latestRelease;
};
