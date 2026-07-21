import { DEFAULT_FILEBROWSER_WORKSPACE_ID } from '@core/constants/workspace';

import { DEMO_DEFAULT_ENABLE_STREAMING } from '../platform/fixtures/demoConfig';
import { DEMO_MUSIC_ROOT } from '../platform/fixtures/fileBrowserTree';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';

import { applyDemoAuthSession } from './demoAuthFixture';
import { DEMO_LINKED_PARTY } from './demoPartyFixture';

export { DEMO_PERSIST_STORAGE_KEYS, resetDemoPersistStorage } from './demoResetStorage';

/**
 * Applies in-memory demo defaults after stores are registered (call from entry.tsx).
 */
export function applyDemoStoreDefaults(): void {
  if (import.meta.env.VITE_APP_MODE !== 'demo') {
    return;
  }

  applyDemoAuthSession();
  const project = useProjectStore.getState();
  project.setLinkedParty(DEMO_LINKED_PARTY);
  project.setPartyThemeId('cyberpunk');
  useSettingsStore.setState({
    exportPath: '',
    lastOpenedPlaylist: '',
    fileBrowserPath: DEMO_MUSIC_ROOT,
    fileBrowserPathsByWorkspaceId: {
      [DEFAULT_FILEBROWSER_WORKSPACE_ID]: DEMO_MUSIC_ROOT,
    },
    enableStreaming: DEMO_DEFAULT_ENABLE_STREAMING,
    streamingSource: 'cherryPlayPlayer',
  });
}
