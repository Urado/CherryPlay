import { resetDemoPersistStorage } from '@shared/demo/demoResetStorage';
import {
  CapacitorPlatform,
  ElectronPlatform,
  setPlatform,
  WebDemoPlatform,
} from '@shared/platform';

const ELECTRON_API_WAIT_MS = 5000;

const BOOTSTRAP_ERROR =
  '[CherryPlayList] Platform bootstrap failed: no supported runtime detected. ' +
  'Use `npm run dev` for Electron, `npm run dev:web` for web demo, or `npm run dev:capacitor` for Capacitor stub.';

const PRELOAD_MISSING_ERROR =
  '[CherryPlayList] Electron preload (window.api) не загрузился. ' +
  'Выполните `npm run compile:electron` и перезапустите `npm run dev`.';

function isElectronUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
}

async function waitForElectronApi(timeoutMs: number): Promise<boolean> {
  if (typeof window !== 'undefined' && typeof window.api !== 'undefined') {
    return true;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (typeof window !== 'undefined' && typeof window.api !== 'undefined') {
      return true;
    }
  }

  return false;
}

export function isDevAuthCallbackDocumentPath(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window.location.pathname === '/auth/callback' ||
      window.location.pathname === '/auth-callback.html')
  );
}

export function redirectDevAuthCallbackToStaticPage(): boolean {
  if (!isDevAuthCallbackDocumentPath()) {
    return false;
  }

  if (window.location.pathname === '/auth-callback.html') {
    return false;
  }

  window.location.replace(`/auth-callback.html${window.location.search}`);
  return true;
}

export async function bootstrapApp(): Promise<void> {
  if (redirectDevAuthCallbackToStaticPage()) {
    await new Promise<void>(() => {});
    return;
  }

  const isDemoMode = import.meta.env.VITE_APP_MODE === 'demo';
  const isCapacitorMode = import.meta.env.VITE_APP_MODE === 'capacitor';

  if (isDemoMode) {
    await resetDemoPersistStorage();
    setPlatform(new WebDemoPlatform(), 'demo');
    return;
  }

  if (isCapacitorMode) {
    setPlatform(new CapacitorPlatform(), 'capacitor');
    return;
  }

  if (await waitForElectronApi(ELECTRON_API_WAIT_MS)) {
    setPlatform(new ElectronPlatform(), 'electron');
    return;
  }

  if (isElectronUserAgent()) {
    throw new Error(PRELOAD_MISSING_ERROR);
  }

  throw new Error(BOOTSTRAP_ERROR);
}
