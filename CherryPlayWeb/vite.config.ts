import { realpathSync } from 'fs';
import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { readWebClientVersion } from './scripts/readWebClientVersion.mjs';
import { legalRoutePlugin } from './vitePlugins/legalRoutePlugin';

const projectRoot = realpathSync.native(__dirname);
const repoRoot = path.resolve(projectRoot, '..');
const cherryPlayComponentsSrc = path.resolve(repoRoot, 'CherryPlayComponents/src');
const clientVersion = readWebClientVersion(projectRoot);

export default defineConfig({
  root: projectRoot,
  envDir: repoRoot,
  define: {
    __APP_VERSION__: JSON.stringify(clientVersion),
  },
  plugins: [
    legalRoutePlugin(),
    react(),
    {
      name: 'watch-cherryplay-components',
      configureServer(server) {
        server.watcher.add(cherryPlayComponentsSrc);
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@cherryplay/components': cherryPlayComponentsSrc,
      '@cherryplay/themes': path.resolve(cherryPlayComponentsSrc, 'themes'),
    },
  },
  optimizeDeps: {
    exclude: ['@cherryplay/components'],
  },
  server: {
    port: 3000,
    fs: {
      allow: [projectRoot, repoRoot],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.message?.includes('contains an annotation that Rollup cannot interpret') &&
          warning.id?.includes('@microsoft/signalr/dist/esm/Utils.js')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
