import { electronStorage } from '../storage/electronStorage';

/** Zustand persist keys cleared when entering web demo (AC12). */
export const DEMO_PERSIST_STORAGE_KEYS = [
  'cherryplaylist-auth',
  'cherryplaylist-settings',
  'cherryplaylist-layout',
  'cherryplaylist-project',
] as const;

/**
 * Clears persisted Electron session data. Call from bootstrap before entry loads stores.
 */
export async function resetDemoPersistStorage(): Promise<void> {
  await Promise.all(DEMO_PERSIST_STORAGE_KEYS.map((key) => electronStorage.removeItem(key)));
}
