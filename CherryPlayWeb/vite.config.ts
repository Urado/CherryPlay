import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@cherryplay/components': path.resolve(__dirname, '../CherryPlayComponents/src'),
      '@cherryplay/themes': path.resolve(__dirname, '../CherryPlayComponents/src/themes'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // SignalR использует прямой URL (CORS настроен на сервере)
      // Proxy для WebSocket может работать нестабильно
    },
  },
});

