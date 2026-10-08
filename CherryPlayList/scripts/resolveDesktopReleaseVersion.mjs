import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const playerTagPattern = /^player-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releasePageSize = 100;
const maximumReleasePages = 100;

const compareNumericIdentifiers = (left, right) => {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
};

const compareVersions = (left, right) => {
  const leftParts = left.split('.');
  const rightParts = right.split('.');
  for (let index = 0; index < 3; index += 1) {
    const compared = compareNumericIdentifiers(leftParts[index], rightParts[index]);
    if (compared !== 0) return compared;
  }
  return 0;
};

export const resolveDesktopReleaseVersion = ({ eventName, tagName, isPrerelease, isDraft, packageVersion }) => {
  if (!tagName.startsWith('player-')) return packageVersion;

  const match = playerTagPattern.exec(tagName);
  if (!match) throw new Error(`Desktop release tags must use player-vX.Y.Z: '${tagName}'`);
  if (isPrerelease !== true) throw new Error(`${tagName} must point to a GitHub prerelease`);
  if (isDraft === true) throw new Error(`${tagName} must not be a draft release`);
  if (eventName !== 'release' && eventName !== 'workflow_dispatch') {
    throw new Error(`Unsupported event: '${eventName}'`);
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
};

export const getLatestDesktopReleaseVersion = async ({
  repository,
  token,
  fetchImpl = fetch,
  timeoutMs = 30_000,
}) => {
  if (!/^[^/]+\/[^/]+$/.test(repository ?? '')) throw new Error('GITHUB_REPOSITORY must use owner/repository format');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const releases = [];
  try {
    for (let page = 1; page <= maximumReleasePages; page += 1) {
      const response = await fetchImpl(
        `https://api.github.com/repos/${repository}/releases?per_page=${releasePageSize}&page=${page}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`GitHub Releases API returned ${response.status}`);
      const pageReleases = await response.json();
      if (!Array.isArray(pageReleases)) throw new Error('GitHub Releases API returned an invalid response');
      releases.push(...pageReleases);
      if (pageReleases.length < releasePageSize) break;
      if (page === maximumReleasePages) throw new Error('GitHub Releases API pagination limit was exceeded');
    }
  } finally {
    clearTimeout(timeout);
  }

  const candidates = releases.flatMap((release) => {
    if (!release || release.draft === true || release.prerelease !== true) return [];
    const match = typeof release.tag_name === 'string' ? playerTagPattern.exec(release.tag_name) : null;
    if (!match) return [];
    const version = `${match[1]}.${match[2]}.${match[3]}`;
    const expectedZips = [`CherryPashkaList-${version}-x64.zip`, `CherryPlayList-${version}-x64.zip`];
    if (!Array.isArray(release.assets) || !release.assets.some((asset) => expectedZips.includes(asset?.name))) return [];
    return [version];
  });

  return candidates.sort(compareVersions).at(-1) ?? '0.0.0';
};

export const stampDesktopPackageVersion = async (packagePath, lockPath, version) => {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const lockJson = JSON.parse(await readFile(lockPath, 'utf8'));
  packageJson.version = version;
  lockJson.version = version;
  if (lockJson.packages?.['']) lockJson.packages[''].version = version;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--latest-release') {
    const version = await getLatestDesktopReleaseVersion({
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
    });
    process.stdout.write(`${version}\n`);
  } else {
    const [packagePath, lockPath] = process.argv.slice(2);
    const eventName = process.env.EVENT_NAME;
    const tagName = process.env.TAG_NAME ?? '';
    const isPrerelease = process.env.IS_PRERELEASE === 'true';
    const isDraft = process.env.IS_DRAFT === 'true';
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    const version = resolveDesktopReleaseVersion({
      eventName,
      tagName,
      isPrerelease,
      isDraft,
      packageVersion: packageJson.version,
    });
    if (tagName.startsWith('player-')) await stampDesktopPackageVersion(packagePath, lockPath, version);
    const updatedPackage = JSON.parse(await readFile(packagePath, 'utf8'));
    if (updatedPackage.version !== version) {
      throw new Error(`Desktop package version '${updatedPackage.version}' does not match release version '${version}'`);
    }
    process.stdout.write(`${version}\n`);
  }
}
