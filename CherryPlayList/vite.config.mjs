import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
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

export default defineConfig({
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
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
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
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@workspaces': path.resolve(__dirname, './src/workspaces'),
      '@app': path.resolve(__dirname, './src/app'),
      '@cherryplay/components': path.resolve(__dirname, '../CherryPlayComponents/src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
    },
  },
});
