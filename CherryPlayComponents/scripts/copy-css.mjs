import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

function copyCssFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const srcPath = join(dir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyCssFiles(srcPath);
      continue;
    }
    if (!entry.endsWith('.css')) {
      continue;
    }
    const rel = relative(srcDir, srcPath);
    const destPath = join(distDir, rel);
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(srcPath, destPath);
  }
}

copyCssFiles(srcDir);
