import '@workspaces/playlist';
import '@workspaces/collection';
import '@workspaces/testZone';
import '@workspaces/player';
import '@workspaces/party';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from '@app';

import './styles/index.css';
import '@cherryplay/components/components/Playlist/PlaylistView.css';
import '@cherryplay/components/components/Playlist/PlaylistItem.css';
import '@cherryplay/components/components/Player/CurrentTrackDisplay.css';
import '@cherryplay/components/themes/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
