import '@workspaces/playlist';
import '@workspaces/collection';
import '@workspaces/testZone';
import '@workspaces/player';
import '@workspaces/party';
import '@workspaces/aimp';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from '@app';
import { applyDemoStoreDefaults } from '@shared/demo/demoReset';
import { loadDemoProjectSafe, shouldAutoLoadDemoProject } from '@shared/demo/loadDemoProject';

// After workspace imports register stores; persisted data was cleared in bootstrap.
applyDemoStoreDefaults();

import './styles/index.css';
import '@cherryplay/components/components/Playlist/PlaylistView.css';
import '@cherryplay/components/components/Playlist/PlaylistItem.css';
import '@cherryplay/components/components/Player/CurrentTrackDisplay.css';
import '@cherryplay/components/themes/index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (shouldAutoLoadDemoProject()) {
  void loadDemoProjectSafe();
}
