/**
 * Backward-compatibility shim.
 *
 * Some dev caches / stale bundles may still reference this module path via
 * older re-export chains. Keep the file in place so startup doesn't fail with
 * "Failed to load url .../core/utils/trackDisplay.ts".
 */
export {};
