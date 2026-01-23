import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import { WorkspaceId } from '@core/types/workspace';

import { FileBrowserView } from './FileBrowserView';

// FileBrowser workspaces use dynamic IDs, so we register a placeholder module
const FileBrowserModule: IWorkspaceModule = {
  id: 'fileBrowser-placeholder' as WorkspaceId,
  type: 'fileBrowser',
  name: 'File Browser',
  component: FileBrowserView,
};

// Register the module
workspaceRegistry.register(FileBrowserModule);

export { FileBrowserView };
export default FileBrowserModule;
