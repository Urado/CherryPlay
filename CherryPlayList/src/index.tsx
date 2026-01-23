// Import workspace modules to register them
import '@workspaces/playlist';
import '@workspaces/collection';
import '@workspaces/fileBrowser';
import '@workspaces/testZone';
import '@workspaces/player';
import '@workspaces/party';
import { App } from '@app';
import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
// Import base CSS from CherryPlayComponents (only for party preview, not affecting main player)
import '@cherryplay/components/components/Playlist/PlaylistView.css';
import '@cherryplay/components/components/Playlist/PlaylistItem.css';
import '@cherryplay/components/components/Player/CurrentTrackDisplay.css';
// Import theme CSS files (only for party preview)
import '@cherryplay/components/themes/cyberpunk/index.css';
import '@cherryplay/components/themes/sakura/index.css';
import '@cherryplay/components/themes/art-deco/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
