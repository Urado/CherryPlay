export interface DesktopUpdate {
  version: string;
}

export type DesktopUpdateCheckResult =
  | { success: true; update: DesktopUpdate | null }
  | { success: false };

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
const REQUEST_TIMEOUT_MS = 10_000;
const TAG_PATTERN = /^player-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CORE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VERSION_WITH_PRERELEASE_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(.*)$/;
const PRERELEASE_PATTERN = /^[0-9A-Za-z.-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAsset = (value: unknown): value is GitHubAsset =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.browser_download_url === 'string';

const isRelease = (value: unknown): value is GitHubRelease =>
  isRecord(value) &&
  typeof value.prerelease === 'boolean' &&
  typeof value.tag_name === 'string' &&
  Array.isArray(value.assets) &&
  value.assets.every(isAsset);

const parseVersion = (version: string): { core: string[]; prerelease: string[] } | null => {
  const match = CORE_VERSION_PATTERN.exec(version) ?? VERSION_WITH_PRERELEASE_PATTERN.exec(version);
  if (!match) return null;
  const prerelease = match[4];
  if (prerelease !== undefined && (!prerelease || !PRERELEASE_PATTERN.test(prerelease)))
    return null;
  return {
    core: [match[1], match[2], match[3]],
    prerelease: prerelease ? prerelease.split('.') : [],
  };
};

const compareNumericIdentifiers = (left: string, right: string): number => {
  const normalizedLeft = left.replace(/^0+(?=\d)/, '');
  const normalizedRight = right.replace(/^0+(?=\d)/, '');
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  }
  return normalizedLeft === normalizedRight ? 0 : normalizedLeft < normalizedRight ? -1 : 1;
};

const isTrustedDownloadUrl = (value: string, version: string, assetName: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.pathname === `/Urado/CherryPlay/releases/download/player-v${version}/${assetName}` &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
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

export const compareDesktopVersions = (left: string, right: string): number | null => {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return null;
  for (let index = 0; index < 3; index += 1) {
    const comparison = compareNumericIdentifiers(leftVersion.core[index], rightVersion.core[index]);
    if (comparison !== 0) return comparison;
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
};

export const checkLatestDesktopUpdate = async (
  fetchReleases: typeof fetch = fetch,
): Promise<DesktopUpdateCheckResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const releases: GitHubRelease[] = [];
    let page = 1;
    while (true) {
      if (controller.signal.aborted) return { success: false };
      const response = await fetchReleases(`${RELEASES_URL}&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!response.ok) return { success: false };
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(isRelease)) return { success: false };
      releases.push(...data);
      if (controller.signal.aborted) return { success: false };
      if (data.length < 100) break;
      page += 1;
    }

    const candidates = releases.flatMap((release) => {
      if (!release.prerelease) return [];
      const match = TAG_PATTERN.exec(release.tag_name);
      if (!match) return [];
      const version = `${match[1]}.${match[2]}.${match[3]}`;
      const assetNames = [
        `CherryPashkaParty-${version}-x64.zip`,
        `CherryPashkaList-${version}-x64.zip`,
      ];
      if (
        !release.assets.some(
          (asset) =>
            assetNames.includes(asset.name) &&
            isTrustedDownloadUrl(asset.browser_download_url, version, asset.name),
        )
      )
        return [];
      return [{ version }];
    });
    const update = candidates.reduce<DesktopUpdate | null>((latest, candidate) => {
      if (!latest) return candidate;
      const comparison = compareDesktopVersions(candidate.version, latest.version);
      return comparison !== null && comparison > 0 ? candidate : latest;
    }, null);
    return { success: true, update };
  } catch {
    return { success: false };
  } finally {
    clearTimeout(timeout);
  }
};

export const getLatestDesktopUpdate = async (
  fetchReleases: typeof fetch = fetch,
): Promise<DesktopUpdate | null> => {
  const result = await checkLatestDesktopUpdate(fetchReleases);
  return result.success ? result.update : null;
};

export const getDesktopDownloadPageUrl = (webBaseUrl: string): string =>
  new URL('/download', webBaseUrl).toString();
