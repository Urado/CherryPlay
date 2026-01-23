import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import { WorkspaceId } from '@core/types/workspace';

import { CollectionView } from './CollectionView';

// Collection workspaces use dynamic IDs, so we register a factory function
// For now, we'll register a placeholder module that will be used for type matching
const CollectionModule: IWorkspaceModule = {
  id: 'collection-placeholder' as WorkspaceId,
  type: 'collection',
  name: 'Collection',
  component: CollectionView,
};

// Register the module
workspaceRegistry.register(CollectionModule);

export { CollectionView };
export default CollectionModule;
