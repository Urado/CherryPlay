import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

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
    cpSync(srcPath, destPath);
  }
}

copyThemeAssets(srcDir);
