import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
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
