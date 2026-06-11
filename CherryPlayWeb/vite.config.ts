import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { readWebClientVersion } from './scripts/readWebClientVersion.mjs';

const cherryPlayComponentsSrc = path.resolve(__dirname, '../CherryPlayComponents/src');
const repoRoot = path.resolve(__dirname, '..');
const clientVersion = readWebClientVersion(__dirname);

export default defineConfig({
  envDir: repoRoot,
  define: {
    __APP_VERSION__: JSON.stringify(clientVersion),
  },
  plugins: [
    react(),
    // Следим за исходниками библиотеки, чтобы изменения подхватывались без перезапуска
    {
      name: 'watch-cherryplay-components',
      configureServer(server) {
        server.watcher.add(cherryPlayComponentsSrc);
      },
    },
  ],
  resolve: {
    alias: {
      '@cherryplay/components': cherryPlayComponentsSrc,
      '@cherryplay/themes': path.resolve(__dirname, '../CherryPlayComponents/src/themes'),
    },
  },
  optimizeDeps: {
    exclude: ['@cherryplay/components'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // SignalR использует прямой URL (CORS настроен на сервере)
      // Proxy для WebSocket может работать нестабильно
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignore known third-party signalr pure-annotation noise in production build logs.
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
