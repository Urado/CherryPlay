/**
 * App version from package.json (injected at build time via Vite define).
 * Single source of truth for display: package.json "version".
 */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
