import { realpathSync } from 'fs';
import path from 'path';

import { defineConfig } from 'vitest/config';

import { readWebClientVersion } from './scripts/readWebClientVersion.mjs';

const projectRoot = realpathSync.native(__dirname);
const cherryPlayComponentsSrc = path.resolve(projectRoot, '../CherryPlayComponents/src');
const clientVersion = readWebClientVersion(projectRoot);

export default defineConfig({
  root: projectRoot,
  define: {
    __APP_VERSION__: JSON.stringify(clientVersion),
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@cherryplay/components': cherryPlayComponentsSrc,
      '@cherryplay/themes': path.resolve(cherryPlayComponentsSrc, 'themes'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 15_000,
  },
});
