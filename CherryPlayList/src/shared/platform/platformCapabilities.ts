import type { AppMode } from './types';

/**
 * Feature flags for gating UI, guards, and stores.
 * Derived from {@link AppMode} — use {@link getPlatformCapabilities()} instead of raw mode checks.
 *
 * | Capability | electron | demo | capacitor (stub) |
 * |------------|----------|------|------------------|
 * | supportsLocalFilePlayback | ✓ | ✗ | ✗ |
 * | supportsNativeFileSystem | ✓ | ✗ | ✗ |
 * | supportsProjectPersistence | ✓ | ✗ | ✗ |
 * | supportsAimpWorkspace | ✓ | ✓ (simulated) | ✗ |
 * | supportsAudioDeviceSelection | ✓ | ✗ | ✗ |
 * | supportsRealAuth | ✓ | ✗ | ✗ |
 * | supportsLoudnessAnalysis | ✓ | ✗ | ✗ |
 * | simulatesExport | ✗ | ✓ | ✗ |
 * | usesFixtureFileBrowser | ✗ | ✓ | ✗ |
 */
export interface PlatformCapabilities {
  readonly mode: AppMode;
  readonly supportsLocalFilePlayback: boolean;
  readonly supportsNativeFileSystem: boolean;
  readonly supportsProjectPersistence: boolean;
  readonly supportsAimpWorkspace: boolean;
  readonly supportsAudioDeviceSelection: boolean;
  readonly supportsRealAuth: boolean;
  readonly supportsLoudnessAnalysis: boolean;
  readonly simulatesExport: boolean;
  readonly usesFixtureFileBrowser: boolean;
}

let cachedCapabilities: PlatformCapabilities | null = null;

export function derivePlatformCapabilities(mode: AppMode): PlatformCapabilities {
  switch (mode) {
    case 'electron':
      return {
        mode,
        supportsLocalFilePlayback: true,
        supportsNativeFileSystem: true,
        supportsProjectPersistence: true,
        supportsAimpWorkspace: true,
        supportsAudioDeviceSelection: true,
        supportsRealAuth: true,
        supportsLoudnessAnalysis: true,
        simulatesExport: false,
        usesFixtureFileBrowser: false,
      };
    case 'demo':
      return {
        mode,
        supportsLocalFilePlayback: false,
        supportsNativeFileSystem: false,
        supportsProjectPersistence: false,
        supportsAimpWorkspace: true,
        supportsAudioDeviceSelection: false,
        supportsRealAuth: false,
        supportsLoudnessAnalysis: false,
        simulatesExport: true,
        usesFixtureFileBrowser: true,
      };
    case 'capacitor':
      return {
        mode,
        supportsLocalFilePlayback: false,
        supportsNativeFileSystem: false,
        supportsProjectPersistence: false,
        supportsAimpWorkspace: false,
        supportsAudioDeviceSelection: false,
        supportsRealAuth: false,
        supportsLoudnessAnalysis: false,
        simulatesExport: false,
        usesFixtureFileBrowser: false,
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function refreshPlatformCapabilities(mode: AppMode): void {
  cachedCapabilities = derivePlatformCapabilities(mode);
}

export function getPlatformCapabilities(): PlatformCapabilities {
  if (!cachedCapabilities) {
    throw new Error(
      'Platform capabilities are not initialized. Call setPlatform() in bootstrap before use.',
    );
  }
  return cachedCapabilities;
}

/** Resets capabilities cache — for unit tests only. */
export function resetPlatformCapabilitiesForTests(): void {
  cachedCapabilities = null;
}
