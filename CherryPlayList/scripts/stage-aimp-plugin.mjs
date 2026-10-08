import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listRoot = path.resolve(__dirname, '..');
const pluginDir = path.join(listRoot, 'plugins', 'CherryPlayAimpBridge');
const manifestPath = path.join(pluginDir, 'manifest.json');

function readManifestMain() {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (typeof manifest.main !== 'string' || !manifest.main.endsWith('.dll')) {
    throw new Error('CherryPlayAimpBridge manifest.json must have a valid "main" DLL filename');
  }
  return manifest.main;
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function findDllSource(dllName, prebuiltOnly) {
  const repoRoot = path.resolve(listRoot, '..');
  const aimpProject = path.join(repoRoot, 'CherryPlayAimpPlugin');
  const prebuiltDll = path.join(aimpProject, 'prebuilt', dllName);

  if (prebuiltOnly) {
    return exists(prebuiltDll) ? prebuiltDll : null;
  }

  const envPath = process.env.CHERRYPLAY_AIMP_DLL;
  if (envPath && exists(envPath)) {
    return envPath;
  }

  const candidates = [
    path.join(aimpProject, 'build', 'vs2026-x64-release', 'Release', dllName),
    path.join(aimpProject, 'build', 'vs2022-x64-release', 'Release', dllName),
    path.join(aimpProject, 'build', 'vs2026-x64-debug', 'Debug', dllName),
    path.join(aimpProject, 'build', 'vs2022-x64-debug', 'Debug', dllName),
    path.join(aimpProject, 'build', 'manual', 'Release', dllName),
    path.join(aimpProject, 'build', 'manual', 'Debug', dllName),
    prebuiltDll,
  ];

  return candidates.find((p) => exists(p)) ?? null;
}

const dllName = readManifestMain();
const prebuiltOnly = process.argv.includes('--prebuilt-only');
const src = findDllSource(dllName, prebuiltOnly);
if (!src) {
  console.error(
    [
      `CherryPlayAimpBridge: could not find ${dllName}.`,
      prebuiltOnly
        ? 'Commit the locally built DLL to CherryPlayAimpPlugin/prebuilt/.'
        : 'Build the native project (CherryPlayAimpPlugin) Release x64, or set CHERRYPLAY_AIMP_DLL to the full path of the DLL.',
      'See CherryPlayAimpPlugin/README.md.',
    ].join('\n'),
  );
  process.exit(1);
}

const dest = path.join(pluginDir, dllName);
fs.mkdirSync(pluginDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`CherryPlayAimpBridge: copied ${dllName} from ${src}`);
