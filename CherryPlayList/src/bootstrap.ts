import { resetDemoPersistStorage } from '@shared/demo/demoResetStorage';
import {
  CapacitorPlatform,
  ElectronPlatform,
  setPlatform,
  WebDemoPlatform,
} from '@shared/platform';

const BOOTSTRAP_ERROR =
  '[CherryPlayList] Platform bootstrap failed: no supported runtime detected. ' +
  'Use `npm run dev` for Electron, `npm run dev:web` for web demo, or `npm run dev:capacitor` for Capacitor stub.';

/**
 * Runs before renderer entry imports stores. Demo mode clears persisted state first.
 */
export async function bootstrapApp(): Promise<void> {
  const isDemoMode = import.meta.env.VITE_APP_MODE === 'demo';
  const isCapacitorMode = import.meta.env.VITE_APP_MODE === 'capacitor';
  const hasElectronApi = typeof window !== 'undefined' && typeof window.api !== 'undefined';

  if (isDemoMode) {
    await resetDemoPersistStorage();
    setPlatform(new WebDemoPlatform(), 'demo');
    return;
  }

  if (isCapacitorMode) {
    setPlatform(new CapacitorPlatform(), 'capacitor');
    return;
  }

  if (hasElectronApi) {
    setPlatform(new ElectronPlatform(), 'electron');
    return;
  }

  throw new Error(BOOTSTRAP_ERROR);
}
