/**
 * Bundles the preload script and all its dependencies (including AIMP contracts)
 * into a single file so it works in Electron's sandbox, which cannot load
 * additional modules from disk.
 */
import path from 'path';
import { fileURLToPath } from 'url';

import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'electron', 'preload.ts');
const outfile = path.join(root, 'dist-electron', 'electron', 'preload.js');

await esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile,
    external: ['electron'],
    sourcemap: false,
    minify: false,
    keepNames: true,
  })
  .catch(() => process.exit(1));

console.log('[bundle-preload] preload.js written to', outfile);
