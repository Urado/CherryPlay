import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listRoot = path.resolve(__dirname, '..');
const releaseDir = path.resolve(listRoot, 'release');
const packageJsonPath = path.join(listRoot, 'package.json');

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function isInsideReleaseDir(candidate) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(releaseDir, resolved);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function removePath(target, attempts = 8) {
  const resolved = path.resolve(target);
  if (!isInsideReleaseDir(resolved)) {
    console.warn(`clean-pack: skip path outside release/: ${resolved}`);
    return false;
  }

  if (!exists(resolved)) {
    return false;
  }

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      if (!exists(resolved)) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(150 * (attempt + 1));
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(`Failed to remove ${resolved}: ${message}`);
}

function collectTargets(version) {
  const dirs = ['win-unpacked', 'linux-unpacked', 'mac', 'mac-arm64', 'mac-universal'];
  const artifacts = [
    `CherryPashkaList-${version}-x64.zip`,
    `CherryPashkaList-${version}-x64-mac.zip`,
    `CherryPashkaList-${version}-arm64-mac.zip`,
    `CherryPlayList-${version}-x64.zip`,
    `CherryPlayList-${version}-x64.dmg`,
    `CherryPlayList-${version}-arm64.dmg`,
    `CherryPlayList-${version}-x64-mac.zip`,
    `CherryPlayList-${version}-arm64-mac.zip`,
    `CherryPlayList-${version}-x64.AppImage`,
    `CherryPlayList-${version}-x64.deb`,
    'builder-debug.yml',
    'builder-effective-config.yaml',
  ];

  const names = new Set([...dirs, ...artifacts]);

  if (exists(releaseDir)) {
    for (const entry of fs.readdirSync(releaseDir, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[A-Za-z0-9._-]+-unpacked$/.test(entry.name)) {
        names.add(entry.name);
      }
    }
  }

  return [...names].map((name) => path.join(releaseDir, name));
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = typeof pkg.version === 'string' ? pkg.version : null;
if (!version) {
  throw new Error('package.json is missing a version field');
}

const targets = collectTargets(version);
const removed = [];
for (const target of targets) {
  if (await removePath(target)) {
    removed.push(path.relative(listRoot, target));
  }
}

if (removed.length === 0) {
  console.log('clean-pack: nothing to remove');
} else {
  console.log(`clean-pack: removed ${removed.join(', ')}`);
}
