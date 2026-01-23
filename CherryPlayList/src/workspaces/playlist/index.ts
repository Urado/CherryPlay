import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { PlaylistView } from './PlaylistView';

const PlaylistModule: IWorkspaceModule = {
  id: DEFAULT_PLAYLIST_WORKSPACE_ID,
  type: 'playlist',
  name: 'Playlist',
  component: PlaylistView,
};

// Register the module
workspaceRegistry.register(PlaylistModule);

export { PlaylistView };
export default PlaylistModule;
