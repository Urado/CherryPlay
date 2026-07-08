import { DEFAULT_FILEBROWSER_WORKSPACE_ID } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { FileBrowserWorkspaceView } from './FileBrowserWorkspaceView';

const FileBrowserModule: IWorkspaceModule = {
  id: DEFAULT_FILEBROWSER_WORKSPACE_ID,
  type: 'fileBrowser',
  name: 'File Browser',
  component: FileBrowserWorkspaceView,
  minWidth: 240,
  minHeight: 200,
};

workspaceRegistry.register(FileBrowserModule);

export { FileBrowserWorkspaceView };
export default FileBrowserModule;
