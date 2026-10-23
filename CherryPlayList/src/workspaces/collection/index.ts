import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { CollectionView } from './CollectionView';

const CollectionModule: IWorkspaceModule = {
  id: 'collection-placeholder',
  type: 'collection',
  name: 'Collection',
  component: CollectionView,
  minWidth: 200,
  minHeight: 150,
};

workspaceRegistry.register(CollectionModule);

export { CollectionView };
export default CollectionModule;
