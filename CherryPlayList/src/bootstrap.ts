import { resetDemoPersistStorage } from '@shared/demo/demoResetStorage';
import { ElectronPlatform, setPlatform, WebDemoPlatform } from '@shared/platform';

const BOOTSTRAP_ERROR =
  '[CherryPlayList] Platform bootstrap failed: neither VITE_APP_MODE=demo nor window.api (Electron preload) is available. ' +
  'Use `npm run dev` for Electron or `npm run dev:web` for web demo.';

/**
 * Runs before renderer entry imports stores. Demo mode clears persisted state first.
 */
export async function bootstrapApp(): Promise<void> {
  const isDemoMode = import.meta.env.VITE_APP_MODE === 'demo';
  const hasElectronApi = typeof window !== 'undefined' && typeof window.api !== 'undefined';

  if (isDemoMode) {
    await resetDemoPersistStorage();
    setPlatform(new WebDemoPlatform(), 'demo');
    return;
  }

  if (hasElectronApi) {
    setPlatform(new ElectronPlatform(), 'electron');
    return;
  }

  throw new Error(BOOTSTRAP_ERROR);
}
