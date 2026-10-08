import { readFileSync, realpathSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import eslint from 'vite-plugin-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = realpathSync.native(__dirname);
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const isDev = process.env.NODE_ENV === 'development';
const shouldLint = process.env.SKIP_LINT !== 'true' && !isDev;

const eslintPlugin = eslint({
  include: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}'],
  lintOnStart: false,
  emitWarning: false,
  emitError: false,
  failOnWarning: false,
  failOnError: false,
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const serverConfigFile = mode === 'production' ? 'serverConfig.production.json' : 'serverConfig.development.json';
  const serverConfig = JSON.parse(readFileSync(path.join(projectRoot, serverConfigFile), 'utf-8'));
  const webBaseUrl = env.VITE_WEB_BASE_URL?.trim() || serverConfig.webBaseUrl;

  return {
    root: projectRoot,
    plugins: [react(), ...(shouldLint ? [eslintPlugin] : [])],
    base: './',
    optimizeDeps: {
      include: [
        '@mui/material',
        '@mui/material/utils',
        '@mui/icons-material',
        'use-sync-external-store/shim/with-selector.js',
      ],
      force: false,
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      'process.env.VITE_DEMO_LIVE': JSON.stringify(process.env.VITE_DEMO_LIVE ?? ''),
      'process.env.VITE_APP_MODE': JSON.stringify(process.env.VITE_APP_MODE ?? ''),
      'import.meta.env.VITE_WEB_BASE_URL': JSON.stringify(webBaseUrl),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
      fs: {
        allow: [projectRoot, path.resolve(projectRoot, '..')],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          bypass(req) {
            const url = req.url ?? '';
            if (url === '/auth/callback' || url.startsWith('/auth/callback?')) {
              return '/auth-callback.html';
            }
          },
        },
        '/partyHub': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(projectRoot, './src'),
        '@core': path.resolve(projectRoot, './src/core'),
        '@shared': path.resolve(projectRoot, './src/shared'),
        '@workspaces': path.resolve(projectRoot, './src/workspaces'),
        '@app': path.resolve(projectRoot, './src/app'),
        '@cherryplay/components': path.resolve(projectRoot, '../CherryPlayComponents/src'),
        react: path.resolve(projectRoot, './node_modules/react'),
        'react-dom': path.resolve(projectRoot, './node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(projectRoot, './node_modules/react/jsx-runtime'),
      },
    },
  };
});
