import { DEFAULT_PARTY_THEME_ID } from '@cherryplay/components';

import { DEFAULT_FILEBROWSER_WORKSPACE_ID } from '@core/constants/workspace';

import { isDemoFixturesMode, isDemoLiveMode } from '../platform/demoLiveMode';
import { DEMO_DEFAULT_ENABLE_STREAMING } from '../platform/fixtures/demoConfig';
import { DEMO_MUSIC_ROOT } from '../platform/fixtures/fileBrowserTree';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';

import { applyDemoAuthSession } from './demoAuthFixture';

export { DEMO_PERSIST_STORAGE_KEYS, resetDemoPersistStorage } from './demoResetStorage';

export function applyDemoStoreDefaults(): void {
  if (!isDemoFixturesMode() && !isDemoLiveMode()) {
    return;
  }

  if (isDemoFixturesMode()) {
    applyDemoAuthSession();
  }

  const project = useProjectStore.getState();
  project.setLinkedParty(null);
  project.setPartyThemeId(DEFAULT_PARTY_THEME_ID);

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
