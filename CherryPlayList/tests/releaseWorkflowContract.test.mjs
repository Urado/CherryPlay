import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  resolveDesktopReleaseVersion,
  getLatestDesktopReleaseVersion,
  stampDesktopPackageVersion,
} from '../scripts/resolveDesktopReleaseVersion.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('desktop player tags require strict stable SemVer and a prerelease release', () => {
  assert.equal(
    resolveDesktopReleaseVersion({
      eventName: 'release',
      tagName: 'player-v1.2.3',
      isPrerelease: true,
      isDraft: false,
      packageVersion: '0.6.4',
    }),
    '1.2.3',
  );
  assert.throws(
    () => resolveDesktopReleaseVersion({ eventName: 'release', tagName: 'player-v01.2.3', isPrerelease: true, isDraft: false, packageVersion: '0.6.4' }),
    /player-vX\.Y\.Z/,
  );
  assert.throws(
    () => resolveDesktopReleaseVersion({ eventName: 'release', tagName: 'player-v1.2.3-beta.1', isPrerelease: true, isDraft: false, packageVersion: '0.6.4' }),
    /player-vX\.Y\.Z/,
  );
  assert.throws(
    () => resolveDesktopReleaseVersion({ eventName: 'release', tagName: 'player-v1.2.3', isPrerelease: false, isDraft: false, packageVersion: '0.6.4' }),
    /prerelease/,
  );
  assert.throws(
    () => resolveDesktopReleaseVersion({ eventName: 'workflow_dispatch', tagName: 'player-v1.2.3', isPrerelease: true, isDraft: true, packageVersion: '0.6.4' }),
    /draft release/,
  );
});

test('latest matching published Desktop release is selected across paginated results', async () => {
  const older = { prerelease: true, draft: false, tag_name: 'player-v0.6.4', assets: [{ name: 'CherryPlayList-0.6.4-x64.zip' }] };
  const latest = { prerelease: true, draft: false, tag_name: 'player-v0.9.0', assets: [{ name: 'CherryPashkaList-0.9.0-x64.zip' }] };
  const pages = [
    [...Array.from({ length: 99 }, () => ({})), older],
    [
      { prerelease: true, draft: false, tag_name: 'player-v2.0.0-beta.1', assets: [{ name: 'CherryPlayList-2.0.0-x64.zip' }] },
      { prerelease: true, draft: false, tag_name: 'player-v0.9.1', assets: [{ name: 'CherryPlayList-0.9.0-x64.zip' }] },
      latest,
    ],
  ];
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    return { ok: true, json: async () => pages[requestedUrls.length - 1] };
  };

  await assert.doesNotReject(async () => {
    assert.equal(
      await getLatestDesktopReleaseVersion({ repository: 'Urado/CherryPlay', token: 'token', fetchImpl }),
      '0.9.0',
    );
  });
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1], /page=2$/);
});

test('latest Desktop release selection falls back to 0.0.0 when no tag has its exact ZIP', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [
      { prerelease: true, draft: false, tag_name: 'player-v1.0.0', assets: [{ name: 'CherryPlayList-0.9.9-x64.zip' }] },
      { prerelease: false, draft: false, tag_name: 'player-v2.0.0', assets: [{ name: 'CherryPlayList-2.0.0-x64.zip' }] },
      { prerelease: true, draft: true, tag_name: 'player-v3.0.0', assets: [{ name: 'CherryPlayList-3.0.0-x64.zip' }] },
    ],
  });

  assert.equal(await getLatestDesktopReleaseVersion({ repository: 'Urado/CherryPlay', fetchImpl }), '0.0.0');
});

test('desktop version stamping updates package and lock root versions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cherryplay-release-'));
  const packagePath = path.join(directory, 'package.json');
  const lockPath = path.join(directory, 'package-lock.json');
  await writeFile(packagePath, JSON.stringify({ name: 'cherryplaylist', version: '0.6.4' }));
  await writeFile(lockPath, JSON.stringify({ version: '0.6.4', packages: { '': { version: '0.6.4' } } }));
  try {
    await stampDesktopPackageVersion(packagePath, lockPath, '1.2.3');
    assert.equal(JSON.parse(await readFile(packagePath, 'utf8')).version, '1.2.3');
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    assert.equal(lock.version, '1.2.3');
    assert.equal(lock.packages[''].version, '1.2.3');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('release workflows verify ZIP naming, stable tags, prerelease status, and compatibility build args', async () => {
  const desktopWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/release-desktop-windows.yml'), 'utf8');
  const pullRequestWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/verify-desktop-windows.yml'), 'utf8');
  const serverWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/release-and-deploy.yml'), 'utf8');
  const serverDockerfile = await readFile(path.join(repositoryRoot, 'CherryPlayServer/Dockerfile'), 'utf8');
  const webDockerfile = await readFile(path.join(repositoryRoot, 'CherryPlayWeb/Dockerfile'), 'utf8');
  const appsettings = await readFile(path.join(repositoryRoot, 'CherryPlayServer/appsettings.json'), 'utf8');
  const desktopPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'CherryPlayList/package.json'), 'utf8'));

  assert.match(desktopWorkflow, /resolveDesktopReleaseVersion\.mjs package\.json package-lock\.json/);
  assert.match(desktopWorkflow, /gh release view "\$\{TAG_NAME\}" --json isPrerelease,isDraft/);
  assert.match(desktopWorkflow, /ZIP="release\/CherryPashkaList-\$\{VERSION\}-x64\.zip"/);
  assert.match(desktopWorkflow, /\[ ! -f "\$\{ZIP\}" \]/);
  assert.match(serverWorkflow, /\^v\(0\|\[1-9\]\[0-9\]\*\)\\\.\(0\|\[1-9\]\[0-9\]\*\)\\\.\(0\|\[1-9\]\[0-9\]\*\)\$/);
  assert.equal((serverWorkflow.match(/CLIENT_COMPATIBILITY_SERVER_VERSION=\$\{\{ steps\.version\.outputs\.server_version \}\}/g) ?? []).length, 2);
  assert.match(serverDockerfile, /ARG CLIENT_COMPATIBILITY_SERVER_VERSION/);
  assert.match(webDockerfile, /ARG CLIENT_COMPATIBILITY_SERVER_VERSION/);
  assert.match(serverDockerfile, /ServerVersion/);
  assert.match(webDockerfile, /ServerVersion/);
  assert.doesNotMatch(serverDockerfile, /MinVersion/);
  assert.doesNotMatch(webDockerfile, /MinVersion/);
  assert.match(appsettings, /"MinVersion":\s*"0\.6\.4"/);
  assert.match(pullRequestWorkflow, /VERSION="\$\{BASE\}-pr-\$\{PR_NUMBER\}"/);
  assert.match(pullRequestWorkflow, /resolveDesktopReleaseVersion\.mjs --latest-release/);
  assert.match(pullRequestWorkflow, /ZIP="release\/CherryPashkaList-\$\{BASE_VERSION\}-pr-\$\{PR_NUMBER\}-x64\.zip"/);
  assert.match(pullRequestWorkflow, /mv "\$\{expected\}" "\$\{ZIP\}"/);
  assert.match(pullRequestWorkflow, /zip_path=CherryPlayList\/\$\{ZIP\}/);
  assert.match(pullRequestWorkflow, /ARTIFACT_NAME="\$\{ZIP_NAME%\.zip\}"/);
  assert.match(pullRequestWorkflow, /App package version \*\*\\`\$\{appVersion\}\\`\*\*; ZIP filename \*\*\\`\$\{zipName\}\\`\*\*; Actions artifact \*\*\\`\$\{artifactName\}\\`\*\*/);
  assert.equal(desktopPackage.build.executableName, 'CherryPashkaList');
  assert.equal(desktopPackage.build.win.artifactName, 'CherryPashkaList-${version}-${arch}.${ext}');
});
