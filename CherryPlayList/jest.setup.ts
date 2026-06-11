import '@testing-library/jest-dom';

import { ElectronPlatform } from './src/shared/platform/electronPlatform';
import { resetPlatformForTests, setPlatform } from './src/shared/platform/platformContext';
import { useGlobalHistoryStore } from './src/shared/stores/globalHistoryStore';

// Default to Electron platform so getPlatformCapabilities() and getPathForFileInRenderer()
// behave like the desktop shell (local files, AIMP, real auth). Individual tests may
// override window.api or call setPlatform() for demo/capacitor scenarios.
beforeEach(() => {
  setPlatform(new ElectronPlatform(), 'electron');
});

afterEach(() => {
  resetPlatformForTests();
  useGlobalHistoryStore.getState().clearHistory();
  if (typeof window !== 'undefined') {
    delete (window as unknown as { api?: unknown }).api;
  }
});

jest.mock('localforage', () => {
  const store = new Map<string, unknown>();
  const instance = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
  return {
    __esModule: true,
    default: {
      createInstance: jest.fn(() => instance),
      INDEXEDDB: 'indexedDB',
      LOCALSTORAGE: 'localStorage',
    },
  };
});
