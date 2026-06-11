import path from 'path';

import { defineConfig } from 'vitest/config';

import { readWebClientVersion } from './scripts/readWebClientVersion.mjs';

const clientVersion = readWebClientVersion(__dirname);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(clientVersion),
  },
  resolve: {
    alias: {
      '@cherryplay/components': path.resolve(__dirname, '../CherryPlayComponents/src'),
      '@cherryplay/themes': path.resolve(__dirname, '../CherryPlayComponents/src/themes'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
