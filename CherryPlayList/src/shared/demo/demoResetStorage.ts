import { isDemoLiveMode } from '../platform/demoLiveMode';
import { electronStorage } from '../storage/electronStorage';

export const DEMO_AUTH_PERSIST_STORAGE_KEY = 'cherryplaylist-auth' as const;

export const DEMO_PERSIST_STORAGE_KEYS = [
  DEMO_AUTH_PERSIST_STORAGE_KEY,
  'cherryplaylist-settings',
  'cherryplaylist-layout',
  'cherryplaylist-workspaces',
  'cherryplaylist-project',
] as const;

export async function resetDemoPersistStorage(): Promise<void> {
  const keys = isDemoLiveMode()
    ? DEMO_PERSIST_STORAGE_KEYS.filter((key) => key !== DEMO_AUTH_PERSIST_STORAGE_KEY)
    : DEMO_PERSIST_STORAGE_KEYS;
  await Promise.all(keys.map((key) => electronStorage.removeItem(key)));
}
