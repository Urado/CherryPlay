import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const distDir = resolve(rootDir, process.argv[2] ?? 'dist');

function copyThemeAssets(dir) {
  for (const entry of readdirSync(dir)) {
    const srcPath = join(dir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyThemeAssets(srcPath);
      continue;
    }
    if (!entry.endsWith('.css') && !entry.endsWith('.jpg') && !entry.endsWith('.png')) {
      continue;
    }
    const rel = relative(srcDir, srcPath);
    const destPath = join(distDir, rel);
    mkdirSync(dirname(destPath), { recursive: true });
    if (existsSync(destPath) && readFileSync(srcPath).equals(readFileSync(destPath))) {
      continue;
    }
    cpSync(srcPath, destPath);
  }
}

copyThemeAssets(srcDir);
